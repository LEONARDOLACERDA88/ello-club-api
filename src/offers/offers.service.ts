import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import * as crypto from 'crypto'

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ── Listar ofertas ────────────────────────────────────────────────────────
  async findAll(params: { category?: string; search?: string; sort?: string }) {
    const where: any = { status: 'ACTIVE' }

    if (params.category) where.category = params.category
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    const offers = await this.prisma.offer.findMany({
      where,
      include: { partner: { select: { id: true, name: true, logo: true, photos: true, category: true } } },
      orderBy: params.sort === 'rating' ? { rating: 'desc' } : { createdAt: 'desc' },
    })

    return { offers, total: offers.length }
  }

  // ── Detalhe oferta ────────────────────────────────────────────────────────
  async findOne(id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { partner: { select: { id: true, name: true, logo: true, photos: true, phone: true, website: true } } },
    })
    if (!offer || offer.status !== 'ACTIVE') throw new NotFoundException('Oferta não encontrada')
    return offer
  }

  // ── Resgatar oferta ───────────────────────────────────────────────────────
  async redeem(userId: string, offerId: string, ip?: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { partner: true },
    })

    if (!offer || offer.status !== 'ACTIVE') throw new NotFoundException('Oferta não disponível')

    if (offer.maxRedemptions && offer.currentRedemptions >= offer.maxRedemptions) {
      throw new BadRequestException('Limite de resgates atingido')
    }

    if (offer.validUntil && offer.validUntil < new Date()) {
      throw new BadRequestException('Oferta expirada')
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuário não encontrado')

    if (user.points < offer.pointsRequired) {
      throw new BadRequestException(`Pontos insuficientes. Necessário: ${offer.pointsRequired}`)
    }

    const savingsAmount = Number(offer.originalPrice) - Number(offer.finalPrice)
    const code = this.generateCode()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    // Tudo em transação atômica — PostgreSQL garante consistência
    const [transaction] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          userId,
          offerId,
          partnerId: offer.partnerId,
          code,
          discount: offer.discount,
          originalPrice: offer.originalPrice,
          finalAmount: offer.finalPrice,
          savingsAmount,
          pointsUsed: offer.pointsRequired,
          expiresAt,
        },
      }),
      this.prisma.offer.update({
        where: { id: offerId },
        data: { currentRedemptions: { increment: 1 } },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { points: { decrement: offer.pointsRequired } },
      }),
    ])

    // Comissão ao parceiro
    if (typeof offer.partner === 'object') {
      const commissionAmount = (Number(offer.finalPrice) * Number((offer.partner as any).commissionRate)) / 100
      await this.prisma.commission.create({
        data: {
          transactionId: transaction.id,
          partnerId: offer.partnerId,
          amount: commissionAmount,
          percentage: (offer.partner as any).commissionRate,
        },
      })
    }

    await this.audit.log({
      userId,
      action: 'offer.redeemed',
      entity: 'Transaction',
      entityId: transaction.id,
      ipAddress: ip,
    })

    // Dispara webhook do parceiro (async, não bloqueia resposta)
    this.dispatchWebhook(offer.partnerId, 'redemption.created', {
      transactionId: transaction.id,
      code,
      userId,
      offerId,
      discount: offer.discount,
      finalAmount: Number(offer.finalPrice),
    }).catch(() => {})

    return {
      code,
      discount: offer.discount,
      finalAmount: Number(offer.finalPrice),
      savingsAmount,
      validUntil: expiresAt.toISOString(),
      pointsRemaining: user.points - offer.pointsRequired,
    }
  }

  // ── Webhook para parceiro ─────────────────────────────────────────────────
  private async dispatchWebhook(partnerId: string, event: string, payload: any) {
    const webhooks = await this.prisma.partnerWebhook.findMany({
      where: { partnerId, active: true, events: { has: event } },
    })

    for (const wh of webhooks) {
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })
      const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex')

      fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ello-Signature': `sha256=${signature}`,
        },
        body,
      }).catch(() => {})
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }
}
