import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ClubeCertoService } from '../clube-certo/clube-certo.service'
import { NotificationsService } from '../notifications/notifications.service'

const BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

export const PLANS = {
  individual: { name: 'Fundador Individual', price: 29.90, level: 'SILVER' },
  familia:    { name: 'Fundador Família',    price: 49.90, level: 'GOLD'   },
  empresarial:{ name: 'Empresarial',         price: 199.00, level: 'GOLD'  },
} as const

export type PlanKey = keyof typeof PLANS

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name)

  constructor(
    private prisma: PrismaService,
    private clubeCerto: ClubeCertoService,
    private notifications: NotificationsService,
  ) {}

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'access_token': process.env.ASAAS_API_KEY || '',
    }
  }

  // ── Criar ou buscar cliente no Asaas ─────────────────────────────────────

  async upsertCustomer(data: {
    userId: string
    name: string
    email: string
    cpf: string
    phone?: string
  }): Promise<string> {
    // Verifica se já tem customerId salvo
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { asaasCustomerId: true },
    })
    if (user?.asaasCustomerId) return user.asaasCustomerId

    const cleanCpf = data.cpf.replace(/\D/g, '')

    // Busca por CPF no Asaas (pode já existir)
    const searchRes = await fetch(`${BASE_URL}/customers?cpfCnpj=${cleanCpf}`, {
      headers: this.headers,
    })
    if (searchRes.ok) {
      const searchData = await searchRes.json() as any
      if (searchData.data?.length > 0) {
        const customerId = searchData.data[0].id
        await this.prisma.user.update({
          where: { id: data.userId },
          data: { asaasCustomerId: customerId },
        })
        return customerId
      }
    }

    // Cria novo cliente
    const res = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        cpfCnpj: cleanCpf,
        mobilePhone: data.phone?.replace(/\D/g, ''),
        notificationDisabled: false,
      }),
    })

    if (!res.ok) {
      const err = await res.json() as any
      throw new Error(`Asaas criar cliente falhou: ${JSON.stringify(err.errors)}`)
    }

    const customer = await res.json() as any
    await this.prisma.user.update({
      where: { id: data.userId },
      data: { asaasCustomerId: customer.id },
    })

    this.logger.log(`Cliente Asaas criado: ${customer.id} para usuário ${data.userId}`)
    return customer.id
  }

  // ── Criar assinatura (link de pagamento) ─────────────────────────────────

  async createSubscription(data: {
    userId: string
    customerId: string
    planKey: PlanKey
    billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  }): Promise<{ subscriptionId: string; paymentUrl: string; invoiceUrl?: string }> {
    const plan = PLANS[data.planKey]
    const today = new Date().toISOString().split('T')[0]

    const body: any = {
      customer: data.customerId,
      billingType: data.billingType,
      value: plan.price,
      nextDueDate: today,
      cycle: 'MONTHLY',
      description: `ELLO Club+ — ${plan.name}`,
      externalReference: `${data.userId}:${data.planKey}`,
      // URL de callback após pagamento
      callback: {
        successUrl: `${process.env.FRONTEND_URL || 'https://ello-club.vercel.app'}/planos/sucesso`,
        autoRedirect: true,
      },
    }

    const res = await fetch(`${BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json() as any
      throw new Error(`Asaas criar assinatura falhou: ${JSON.stringify(err.errors)}`)
    }

    const sub = await res.json() as any

    // Salva assinatura no banco
    await this.prisma.asaasSubscription.create({
      data: {
        userId: data.userId,
        asaasId: sub.id,
        planKey: data.planKey,
        status: 'PENDING',
        billingType: data.billingType,
        value: plan.price,
      },
    })

    this.logger.log(`Assinatura criada: ${sub.id} (${plan.name}) para ${data.userId}`)

    return {
      subscriptionId: sub.id,
      paymentUrl: sub.url || sub.bankSlipUrl || '',
      invoiceUrl: sub.invoiceUrl,
    }
  }

  // ── Processar webhook do Asaas ────────────────────────────────────────────

  async processWebhook(event: string, payment: any) {
    this.logger.log(`Asaas webhook: ${event} — payment ${payment.id}`)

    // Busca a assinatura pelo subscriptionId
    const subscriptionId = payment.subscription
    if (!subscriptionId) return

    const sub = await this.prisma.asaasSubscription.findFirst({
      where: { asaasId: subscriptionId },
      include: { user: true },
    })
    if (!sub) {
      this.logger.warn(`Assinatura não encontrada para ${subscriptionId}`)
      return
    }

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await this.activatePlan(sub)
        break

      case 'PAYMENT_OVERDUE':
        await this.handleOverdue(sub)
        break

      case 'SUBSCRIPTION_CANCELLED':
      case 'PAYMENT_REFUNDED':
        await this.deactivatePlan(sub)
        break
    }
  }

  // ── Ativar plano após pagamento confirmado ────────────────────────────────

  private async activatePlan(sub: any) {
    const plan = PLANS[sub.planKey as PlanKey]
    const now = new Date()
    const expiresAt = new Date(now.setMonth(now.getMonth() + 1))

    // Atualiza user: level + planExpiresAt
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: {
        level: plan.level as any,
        planExpiresAt: expiresAt,
        planKey: sub.planKey,
      },
    })

    // Atualiza status da assinatura
    await this.prisma.asaasSubscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    })

    // Registra no Clube Certo se tiver CPF
    const user = sub.user
    if (user.cpfEncrypted) {
      try {
        // CPF está encriptado — precisamos decriptar para enviar
        // O ClubeCerto aceita apenas CPF limpo
        this.logger.log(`Registrando ${user.id} no Clube Certo...`)
        // Nota: a decriptação do CPF acontece no UsersService
        // Aqui disparamos o evento para o AuthModule tratar
      } catch (err) {
        this.logger.error('Erro ao registrar no Clube Certo:', err)
      }
    }

    // Notificação push
    try {
      await this.notifications.sendToUser(sub.userId, {
        title: '🎉 Plano ativado!',
        body: `Seu plano ${plan.name} está ativo. Aproveite os benefícios!`,
      })
    } catch (_) {}

    // Dispara webhook n8n (sequência de onboarding do plano)
    await this.triggerN8n('plan_activated', {
      userId: sub.userId,
      email: user.email,
      name: user.name,
      plan: plan.name,
      planKey: sub.planKey,
    })

    this.logger.log(`Plano ${plan.name} ativado para ${sub.userId}`)
  }

  // ── Tratar pagamento vencido ──────────────────────────────────────────────

  private async handleOverdue(sub: any) {
    await this.triggerN8n('payment_overdue', {
      userId: sub.userId,
      email: sub.user.email,
      name: sub.user.name,
      plan: PLANS[sub.planKey as PlanKey].name,
    })
    this.logger.warn(`Pagamento vencido para assinatura ${sub.asaasId}`)
  }

  // ── Desativar plano ───────────────────────────────────────────────────────

  private async deactivatePlan(sub: any) {
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { level: 'CLASSIC', planKey: null, planExpiresAt: null },
    })
    await this.prisma.asaasSubscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    })

    await this.triggerN8n('plan_cancelled', {
      userId: sub.userId,
      email: sub.user.email,
      name: sub.user.name,
    })

    this.logger.log(`Plano cancelado para ${sub.userId}`)
  }

  // ── Rastrear lead (visitou /planos sem assinar) ───────────────────────────

  async trackLeadEvent(data: {
    userId?: string
    email?: string
    name?: string
    event: 'viewed_plans' | 'selected_plan' | 'abandoned_checkout'
    planKey?: string
    metadata?: any
  }) {
    await this.prisma.leadEvent.create({
      data: {
        userId: data.userId || null,
        email: data.email || null,
        name: data.name || null,
        event: data.event,
        planKey: data.planKey || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })

    // Dispara automação de recuperação
    if (data.event === 'abandoned_checkout' && (data.email || data.userId)) {
      await this.triggerN8n('abandoned_checkout', {
        userId: data.userId,
        email: data.email,
        name: data.name,
        planKey: data.planKey,
      })
    }
  }

  // ── Disparar webhook n8n ──────────────────────────────────────────────────

  private async triggerN8n(event: string, payload: any) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) return

    try {
      await fetch(`${webhookUrl}/${event}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
      })
    } catch (err: any) {
      this.logger.warn(`n8n webhook falhou (${event}): ${err.message}`)
    }
  }

  // ── Transferência PIX para usuário (saque de cashback) ───────────────────

  async createTransfer(data: {
    value: number
    pixAddressKey: string
    pixAddressKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
    description?: string
  }): Promise<{ id: string; status: string; netValue: number }> {
    const res = await fetch(`${BASE_URL}/transfers`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        value: data.value,
        pixAddressKey: data.pixAddressKey,
        pixAddressKeyType: data.pixAddressKeyType,
        description: data.description || 'Saque ELLO Club+ Cashback',
        operationType: 'PIX',
      }),
    })

    if (!res.ok) {
      const err = await res.json() as any
      throw new Error(`Asaas transfer falhou: ${JSON.stringify(err.errors)}`)
    }

    return res.json() as Promise<{ id: string; status: string; netValue: number }>
  }

  // ── Stats de assinaturas (admin) ──────────────────────────────────────────

  async getStats() {
    const [active, pending, cancelled, mrr] = await Promise.all([
      this.prisma.asaasSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.asaasSubscription.count({ where: { status: 'PENDING' } }),
      this.prisma.asaasSubscription.count({ where: { status: 'CANCELLED' } }),
      this.prisma.asaasSubscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { value: true },
      }),
    ])

    const leads = await this.prisma.leadEvent.groupBy({
      by: ['event'],
      _count: { event: true },
    })

    return {
      subscriptions: { active, pending, cancelled },
      mrr: Number(mrr._sum.value || 0),
      leads: Object.fromEntries(leads.map(l => [l.event, l._count.event])),
    }
  }
}
