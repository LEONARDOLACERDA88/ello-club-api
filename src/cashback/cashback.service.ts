import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { AsaasService } from '../asaas/asaas.service'

const CC_BASE_URL  = process.env.CLUBE_CERTO_BASE_URL || 'https://node.clubecerto.com.br/superapp'
const CC_COMPANY_ID = process.env.CLUBE_CERTO_COMPANY_ID || '1735'

// 70% da comissão vai para o usuário, 30% fica na ELLO
const USER_SHARE = 0.70

// Saque mínimo
const MIN_WITHDRAWAL = 20

@Injectable()
export class CashbackService {
  private readonly logger = new Logger(CashbackService.name)

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private asaas: AsaasService,
  ) {}

  // ── Carteira do usuário ───────────────────────────────────────────────────

  async getWallet(userId: string) {
    const txs = await this.prisma.cashbackTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const saldoDisponivel = txs
      .filter(t => t.status === 'CONFIRMED')
      .reduce((s, t) => s + Number(t.cashbackAmount), 0)

    const saldoPendente = txs
      .filter(t => t.status === 'PENDING')
      .reduce((s, t) => s + Number(t.cashbackAmount), 0)

    const totalGanho = txs
      .filter(t => t.status === 'CONFIRMED' || t.status === 'WITHDRAWN')
      .reduce((s, t) => s + Number(t.cashbackAmount), 0)

    const comprasAtivas = txs.filter(t => t.status !== 'CANCELLED').length
    const ticketMedio = comprasAtivas > 0
      ? txs.filter(t => t.status !== 'CANCELLED').reduce((s, t) => s + Number(t.purchaseAmount), 0) / comprasAtivas
      : 0

    return {
      saldoDisponivel: Number(saldoDisponivel.toFixed(2)),
      saldoPendente: Number(saldoPendente.toFixed(2)),
      totalGanho: Number(totalGanho.toFixed(2)),
      comprasAtivas,
      ticketMedio: Number(ticketMedio.toFixed(2)),
      transactions: txs.map(t => ({
        id: t.id,
        loja: t.storeName,
        logoLoja: t.storeLogo,
        fonte: t.source,
        status: t.status.toLowerCase(),
        valorCompra: Number(t.purchaseAmount),
        valorCashback: Number(t.cashbackAmount),
        percentual: Number(t.cashbackPercent),
        data: t.createdAt.toISOString().split('T')[0],
      })),
    }
  }

  // ── Solicitar saque ───────────────────────────────────────────────────────

  async requestWithdrawal(userId: string, pixKey: string) {
    const pixKeyType = this.detectPixKeyType(pixKey)

    // Busca transações confirmadas disponíveis
    const confirmed = await this.prisma.cashbackTransaction.findMany({
      where: { userId, status: 'CONFIRMED', withdrawalId: null },
    })

    const total = confirmed.reduce((s, t) => s + Number(t.cashbackAmount), 0)

    if (total < MIN_WITHDRAWAL) {
      throw new BadRequestException(
        `Saldo insuficiente. Mínimo R$${MIN_WITHDRAWAL},00. Disponível: R$${total.toFixed(2)}`
      )
    }

    // Cria registro de saque
    const withdrawal = await this.prisma.cashbackWithdrawal.create({
      data: {
        userId,
        amount: total,
        pixKey,
        pixKeyType,
        status: 'PENDING',
      },
    })

    // Vincula transações ao saque e marca como WITHDRAWN
    await this.prisma.cashbackTransaction.updateMany({
      where: { id: { in: confirmed.map(t => t.id) } },
      data: { status: 'WITHDRAWN', withdrawalId: withdrawal.id },
    })

    this.logger.log(`Saque R$${total.toFixed(2)} solicitado pelo usuário ${userId}`)

    // Executa transferência PIX via Asaas (assíncrono)
    setImmediate(() => this.executeTransfer(withdrawal.id, total, pixKey, pixKeyType, userId))

    return {
      id: withdrawal.id,
      amount: total,
      pixKey,
      pixKeyType,
      status: 'PENDING',
      message: `Saque de R$${total.toFixed(2)} solicitado. PIX em até 3 dias úteis.`,
    }
  }

  // ── Executar transferência PIX no Asaas ──────────────────────────────────

  private async executeTransfer(
    withdrawalId: string,
    amount: number,
    pixKey: string,
    pixKeyType: string,
    userId: string,
  ) {
    try {
      await this.prisma.cashbackWithdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'PROCESSING' },
      })

      const transfer = await this.asaas.createTransfer({
        value: amount,
        pixAddressKey: pixKey,
        pixAddressKeyType: pixKeyType as any,
        description: `ELLO Club+ Cashback — saque #${withdrawalId.slice(0, 8)}`,
      })

      await this.prisma.cashbackWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          asaasTransferId: transfer.id,
          status: 'DONE',
          processedAt: new Date(),
        },
      })

      this.logger.log(`Transferência ${transfer.id} concluída para ${userId}`)

      await this.notifications.sendToUser(userId, {
        title: 'Cashback enviado!',
        body: `R$${amount.toFixed(2)} chegando na sua chave PIX em instantes.`,
      })
    } catch (err: any) {
      this.logger.error(`Falha na transferência ${withdrawalId}: ${err.message}`)

      await this.prisma.cashbackWithdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'FAILED' },
      })

      // Devolve transações para CONFIRMED se falhar
      await this.prisma.cashbackTransaction.updateMany({
        where: { withdrawalId },
        data: { status: 'CONFIRMED', withdrawalId: null },
      })

      await this.notifications.sendToUser(userId, {
        title: 'Erro no saque',
        body: 'Houve um problema ao processar seu saque. Tente novamente em breve.',
      })
    }
  }

  // ── Webhook Lomadee ───────────────────────────────────────────────────────
  // publisher_source_id = userId ELLO (passado no subId do link de afiliado)

  async processLomadeeWebhook(payload: any) {
    this.logger.log(`Lomadee webhook: ${JSON.stringify(payload).slice(0, 200)}`)

    const userId: string = payload.publisher_source_id || payload.source_id
    if (!userId) {
      this.logger.warn('Lomadee webhook sem userId (publisher_source_id)')
      return { ok: true }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      this.logger.warn(`Lomadee: usuário ${userId} não encontrado`)
      return { ok: true }
    }

    const orderId   = String(payload.order_id || payload.transaction_id || '')
    const status    = payload.status // 1=aprovado, 2=pendente, 3=cancelado
    const storeId   = payload.store_id || ''
    const storeName = payload.store_name || payload.program_name || 'Loja parceira'
    const purchaseAmount  = Number(payload.order_price || payload.sale_amount || 0)
    const commissionValue = Number(payload.commission || payload.publisher_commission || 0)

    if (!orderId || purchaseAmount <= 0) return { ok: true }

    // Verifica duplicata
    const existing = await this.prisma.cashbackTransaction.findUnique({
      where: { externalOrderId_source: { externalOrderId: orderId, source: 'lomadee' } },
    })

    const cashbackAmount  = Number((commissionValue * USER_SHARE).toFixed(2))
    const cashbackPercent = purchaseAmount > 0
      ? Number(((cashbackAmount / purchaseAmount) * 100).toFixed(2))
      : 0

    if (existing) {
      // Atualiza status da conversão já existente
      if (status === 3 || status === 'cancelled') {
        await this.prisma.cashbackTransaction.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED' },
        })
      } else if ((status === 1 || status === 'approved') && existing.status === 'PENDING') {
        await this.prisma.cashbackTransaction.update({
          where: { id: existing.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        })
        await this.notifications.sendToUser(userId, {
          title: 'Cashback confirmado!',
          body: `R$${cashbackAmount.toFixed(2)} de cashback confirmado na ${storeName}.`,
        })
      }
      return { ok: true }
    }

    // Nova conversão
    const newStatus = status === 1 || status === 'approved' ? 'CONFIRMED' : 'PENDING'

    await this.prisma.cashbackTransaction.create({
      data: {
        userId,
        source: 'lomadee',
        externalOrderId: orderId,
        storeName,
        storeLogo: null,
        purchaseAmount,
        commissionValue,
        cashbackAmount,
        cashbackPercent,
        status: newStatus as any,
        confirmedAt: newStatus === 'CONFIRMED' ? new Date() : null,
      },
    })

    this.logger.log(`Cashback Lomadee criado: ${cashbackAmount} para usuário ${userId}`)

    if (newStatus === 'CONFIRMED') {
      await this.notifications.sendToUser(userId, {
        title: 'Cashback confirmado!',
        body: `R$${cashbackAmount.toFixed(2)} disponível na sua carteira ELLO.`,
      })
    } else {
      await this.notifications.sendToUser(userId, {
        title: 'Cashback pendente',
        body: `R$${cashbackAmount.toFixed(2)} de cashback em análise na ${storeName}.`,
      })
    }

    return { ok: true }
  }

  // ── Webhook Afilio ────────────────────────────────────────────────────────

  async processAfilioWebhook(payload: any) {
    this.logger.log(`Afilio webhook: ${JSON.stringify(payload).slice(0, 200)}`)

    const userId = payload.sub_id || payload.publisher_sub_id
    if (!userId) return { ok: true }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { ok: true }

    const orderId        = String(payload.transaction_id || payload.order_id || '')
    const storeName      = payload.program_name || 'Loja parceira'
    const purchaseAmount = Number(payload.sale_amount || 0)
    const commissionValue = Number(payload.commission || 0)
    const isApproved     = payload.status === 'approved' || payload.status === 1

    if (!orderId || purchaseAmount <= 0) return { ok: true }

    const existing = await this.prisma.cashbackTransaction.findUnique({
      where: { externalOrderId_source: { externalOrderId: orderId, source: 'afilio' } },
    })

    const cashbackAmount  = Number((commissionValue * USER_SHARE).toFixed(2))
    const cashbackPercent = purchaseAmount > 0
      ? Number(((cashbackAmount / purchaseAmount) * 100).toFixed(2))
      : 0

    if (existing) {
      if (payload.status === 'cancelled' || payload.status === 3) {
        await this.prisma.cashbackTransaction.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED' },
        })
      } else if (isApproved && existing.status === 'PENDING') {
        await this.prisma.cashbackTransaction.update({
          where: { id: existing.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        })
      }
      return { ok: true }
    }

    const newStatus = isApproved ? 'CONFIRMED' : 'PENDING'

    await this.prisma.cashbackTransaction.create({
      data: {
        userId,
        source: 'afilio',
        externalOrderId: orderId,
        storeName,
        purchaseAmount,
        commissionValue,
        cashbackAmount,
        cashbackPercent,
        status: newStatus as any,
        confirmedAt: newStatus === 'CONFIRMED' ? new Date() : null,
      },
    })

    return { ok: true }
  }

  // ── Cron: auto-confirmar após 30 dias ─────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoConfirmPending() {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await this.prisma.cashbackTransaction.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: thirtyDaysAgo },
      },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    })

    if (result.count > 0) {
      this.logger.log(`Auto-confirmados ${result.count} cashbacks pendentes (>30 dias)`)
    }
  }

  // ── Webhook Clube Certo ───────────────────────────────────────────────────
  // Clube Certo envia postback com CPF do usuário + dados da transação
  // Lookup por cpfHash (SHA-256 do CPF limpo — não reversível, seguro)

  async processClubeCertoWebhook(payload: any) {
    this.logger.log(`Clube Certo webhook: ${JSON.stringify(payload).slice(0, 200)}`)

    // Tenta encontrar o CPF no payload (vários formatos possíveis)
    const cpfRaw: string = payload.cpf || payload.associateCpf || payload.user_cpf || ''
    if (!cpfRaw) {
      this.logger.warn('Clube Certo webhook sem CPF')
      return { ok: true }
    }

    const cpfHash = crypto.createHash('sha256').update(cpfRaw.replace(/\D/g, '')).digest('hex')
    const user = await this.prisma.user.findUnique({ where: { cpfHash } })
    if (!user) {
      this.logger.warn(`Clube Certo: usuário com CPF hash ${cpfHash.slice(0, 8)}... não encontrado`)
      return { ok: true }
    }

    const orderId        = String(payload.transaction_id || payload.transactionId || payload.id || '')
    const storeName      = payload.store_name || payload.storeName || payload.establishment_name || 'Parceiro Clube Certo'
    const purchaseAmount = Number(payload.purchase_amount || payload.purchaseAmount || payload.amount || 0)
    const cashbackAmount = Number(payload.cashback_amount || payload.cashbackAmount || payload.cashback || 0)
    const cashbackPct    = purchaseAmount > 0
      ? Number(((cashbackAmount / purchaseAmount) * 100).toFixed(2))
      : Number(payload.cashback_percent || payload.cashbackPercent || 0)

    const statusRaw = (payload.status || 'confirmed').toString().toLowerCase()
    const isCancelled = statusRaw === 'cancelled' || statusRaw === 'canceled' || statusRaw === '3'
    const isApproved  = statusRaw === 'confirmed' || statusRaw === 'approved' || statusRaw === '1'
    const newStatus   = isCancelled ? 'CANCELLED' : isApproved ? 'CONFIRMED' : 'PENDING'

    if (!orderId || purchaseAmount <= 0) {
      this.logger.warn('Clube Certo webhook: orderId ou valor inválido')
      return { ok: true }
    }

    // Verifica duplicata
    const existing = orderId
      ? await this.prisma.cashbackTransaction.findUnique({
          where: { externalOrderId_source: { externalOrderId: orderId, source: 'clube_certo' } },
        })
      : null

    if (existing) {
      if (isCancelled) {
        await this.prisma.cashbackTransaction.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED' },
        })
      } else if (isApproved && existing.status === 'PENDING') {
        await this.prisma.cashbackTransaction.update({
          where: { id: existing.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        })
        await this.notifications.sendToUser(user.id, {
          title: 'Cashback confirmado!',
          body: `R$${cashbackAmount.toFixed(2)} de cashback confirmado na ${storeName}.`,
        })
      }
      return { ok: true }
    }

    // Nova transação
    await this.prisma.cashbackTransaction.create({
      data: {
        userId:          user.id,
        source:          'clube_certo',
        externalOrderId: orderId || undefined,
        storeName,
        purchaseAmount,
        commissionValue: cashbackAmount, // Clube Certo já repassa o valor direto
        cashbackAmount,                  // 100% — Clube Certo tem contrato direto conosco
        cashbackPercent: cashbackPct,
        status:          newStatus as any,
        confirmedAt:     newStatus === 'CONFIRMED' ? new Date() : null,
      },
    })

    this.logger.log(`Cashback Clube Certo: R$${cashbackAmount} para usuário ${user.id} (${storeName})`)

    if (newStatus !== 'CANCELLED') {
      await this.notifications.sendToUser(user.id, {
        title: newStatus === 'CONFIRMED' ? 'Cashback confirmado!' : 'Cashback pendente',
        body: `R$${cashbackAmount.toFixed(2)} de cashback na ${storeName}.`,
      })
    }

    return { ok: true }
  }

  // ── Cron: polling Clube Certo (fallback se não tiver webhook) ─────────────
  // Roda às 06:00 todo dia — consulta transações recentes de cashback
  // e sincroniza com usuários ELLO via cpfHash

  @Cron('0 6 * * *')
  async pollClubeCertoTransactions() {
    this.logger.log('Polling Clube Certo cashback transactions...')
    try {
      // Autenticação
      const loginRes = await fetch(`${CC_BASE_URL}/companyAPI/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: (process.env.CLUBE_CERTO_CNPJ || '').replace(/\D/g, ''),
          password: process.env.CLUBE_CERTO_PASSWORD || '',
        }),
      })
      if (!loginRes.ok) {
        this.logger.warn('Polling Clube Certo: login falhou')
        return
      }
      const { token: companyToken } = await loginRes.json() as { token: string }

      // Busca transações de cashback dos últimos 2 dias
      const since = new Date()
      since.setDate(since.getDate() - 2)
      const sinceStr = since.toISOString().split('T')[0]

      const txRes = await fetch(
        `${CC_BASE_URL}/companyAPI/cashback/transactions?since=${sinceStr}&companyId=${CC_COMPANY_ID}`,
        { headers: { Authorization: `Bearer ${companyToken}` } },
      )

      if (!txRes.ok) {
        this.logger.warn(`Polling Clube Certo: endpoint de transações retornou ${txRes.status}`)
        return
      }

      const transactions = await txRes.json() as any[]
      let synced = 0

      for (const tx of transactions) {
        try {
          await this.processClubeCertoWebhook(tx)
          synced++
        } catch (_) {}
      }

      this.logger.log(`Polling Clube Certo: ${synced}/${transactions.length} transações sincronizadas`)
    } catch (err: any) {
      this.logger.warn(`Polling Clube Certo falhou: ${err.message}`)
    }
  }

  // ── Admin: criar cashback manual ──────────────────────────────────────────

  async createManual(data: {
    userId: string
    storeName: string
    source: string
    purchaseAmount: number
    commissionValue: number
    status?: 'PENDING' | 'CONFIRMED'
  }) {
    const cashbackAmount  = Number((data.commissionValue * USER_SHARE).toFixed(2))
    const cashbackPercent = data.purchaseAmount > 0
      ? Number(((cashbackAmount / data.purchaseAmount) * 100).toFixed(2))
      : 0

    return this.prisma.cashbackTransaction.create({
      data: {
        userId: data.userId,
        source: data.source,
        storeName: data.storeName,
        purchaseAmount: data.purchaseAmount,
        commissionValue: data.commissionValue,
        cashbackAmount,
        cashbackPercent,
        status: (data.status || 'PENDING') as any,
        confirmedAt: data.status === 'CONFIRMED' ? new Date() : null,
      },
    })
  }

  // ── Admin: stats gerais ───────────────────────────────────────────────────

  async getAdminStats() {
    const [total, pending, confirmed, withdrawn, totalPaidOut] = await Promise.all([
      this.prisma.cashbackTransaction.count(),
      this.prisma.cashbackTransaction.count({ where: { status: 'PENDING' } }),
      this.prisma.cashbackTransaction.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.cashbackTransaction.count({ where: { status: 'WITHDRAWN' } }),
      this.prisma.cashbackWithdrawal.aggregate({
        where: { status: 'DONE' },
        _sum: { amount: true },
      }),
    ])

    return {
      total,
      pending,
      confirmed,
      withdrawn,
      totalPaidOut: Number(totalPaidOut._sum.amount || 0),
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private detectPixKeyType(key: string): string {
    const clean = key.trim()
    if (/^\d{11}$/.test(clean.replace(/\D/g, '')) && !clean.includes('@'))
      return 'CPF'
    if (/^\d{14}$/.test(clean.replace(/\D/g, '')))
      return 'CNPJ'
    if (clean.includes('@'))
      return 'EMAIL'
    if (/^\+?\d{10,13}$/.test(clean.replace(/[\s\-()]/g, '')))
      return 'PHONE'
    return 'EVP' // chave aleatória UUID
  }
}
