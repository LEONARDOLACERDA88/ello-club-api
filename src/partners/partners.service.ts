import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { CryptoService } from '../common/crypto/crypto.service'
import { AuditService } from '../audit/audit.service'
import { RegisterPartnerDto } from './dto/register-partner.dto'
import { CreateOfferDto } from './dto/create-offer.dto'
import { CreateWebhookDto } from './dto/create-webhook.dto'

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
  ) {}

  // ── Registro ──────────────────────────────────────────────────────────────
  async register(dto: RegisterPartnerDto, ip?: string) {
    const [emailExists, cnpjExists] = await Promise.all([
      this.prisma.partner.findUnique({ where: { email: dto.email } }),
      this.prisma.partner.findUnique({ where: { cnpj: dto.cnpj } }),
    ])
    if (emailExists) throw new ConflictException('E-mail já cadastrado')
    if (cnpjExists) throw new ConflictException('CNPJ já cadastrado')

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const partner = await this.prisma.partner.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        cnpj: dto.cnpj,
        category: dto.category,
        phone: dto.phone,
        website: dto.website,
        description: dto.description,
        status: 'PENDING', // aguarda aprovação do admin
      },
    })

    await this.audit.log({
      action: 'partner.registered',
      entity: 'Partner',
      entityId: partner.id,
      ipAddress: ip,
    })

    return this.safePartner(partner)
  }

  // ── Perfil ────────────────────────────────────────────────────────────────
  async getProfile(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        addresses: true,
        _count: { select: { offers: true, transactions: true } },
      },
    })
    if (!partner) throw new NotFoundException('Parceiro não encontrado')
    return this.safePartner(partner)
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboard(partnerId: string) {
    const [partner, offers, stats, recentTransactions] = await Promise.all([
      this.prisma.partner.findUnique({ where: { id: partnerId } }),

      this.prisma.offer.findMany({
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      this.prisma.transaction.aggregate({
        where: { partnerId },
        _sum: { savingsAmount: true, finalAmount: true },
        _count: true,
      }),

      this.prisma.transaction.findMany({
        where: { partnerId },
        include: { user: { select: { name: true } }, offer: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const pendingCommissions = await this.prisma.commission.aggregate({
      where: { partnerId, status: 'PENDING' },
      _sum: { amount: true },
    })

    return {
      partner: this.safePartner(partner!),
      offers,
      stats: {
        totalRedemptions: stats._count,
        totalSales: Number(stats._sum.finalAmount ?? 0),
        totalSavingsGenerated: Number(stats._sum.savingsAmount ?? 0),
        pendingCommissions: Number(pendingCommissions._sum.amount ?? 0),
      },
      recentTransactions,
    }
  }

  // ── Ofertas ───────────────────────────────────────────────────────────────
  async getOffers(partnerId: string) {
    return this.prisma.offer.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createOffer(partnerId: string, dto: CreateOfferDto) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } })
    if (!partner) throw new NotFoundException()
    if (partner.status !== 'ACTIVE') {
      throw new ForbiddenException('Conta pendente de aprovação. Não é possível criar ofertas ainda.')
    }

    const finalPrice = dto.originalPrice * (1 - dto.discount / 100)

    const offer = await this.prisma.offer.create({
      data: {
        partnerId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        discount: dto.discount,
        originalPrice: dto.originalPrice,
        finalPrice: parseFloat(finalPrice.toFixed(2)),
        pointsRequired: dto.pointsRequired,
        image: dto.image,
        maxRedemptions: dto.maxRedemptions,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        restrictions: dto.restrictions,
        status: 'ACTIVE',
      },
    })

    await this.audit.log({
      action: 'offer.created',
      entity: 'Offer',
      entityId: offer.id,
    })

    return offer
  }

  async updateOffer(partnerId: string, offerId: string, dto: Partial<CreateOfferDto>) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } })
    if (!offer) throw new NotFoundException('Oferta não encontrada')
    if (offer.partnerId !== partnerId) throw new ForbiddenException('Sem permissão para editar esta oferta')

    const data: any = { ...dto }

    // Recalcula preço final se mudou desconto ou preço original
    if (dto.discount !== undefined || dto.originalPrice !== undefined) {
      const originalPrice = dto.originalPrice ?? Number(offer.originalPrice)
      const discount = dto.discount ?? offer.discount
      data.finalPrice = parseFloat((originalPrice * (1 - discount / 100)).toFixed(2))
    }

    if (dto.validUntil) data.validUntil = new Date(dto.validUntil)

    return this.prisma.offer.update({ where: { id: offerId }, data })
  }

  async deleteOffer(partnerId: string, offerId: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id: offerId } })
    if (!offer) throw new NotFoundException('Oferta não encontrada')
    if (offer.partnerId !== partnerId) throw new ForbiddenException()

    // Soft delete — preserva histórico de transações
    await this.prisma.offer.update({
      where: { id: offerId },
      data: { status: 'INACTIVE' },
    })
  }

  // ── API Key (integração B2B) ───────────────────────────────────────────────
  async generateApiKey(partnerId: string) {
    const rawKey = this.crypto.generateApiKey() // ello_pk_<64 hex chars>
    const keyHash = this.crypto.hashSha256(rawKey)

    await this.prisma.partner.update({
      where: { id: partnerId },
      data: { apiKeyHash: keyHash },
    })

    await this.audit.log({
      action: 'partner.api_key_generated',
      entity: 'Partner',
      entityId: partnerId,
    })

    // Retorna a chave APENAS neste momento — nunca mais será exibida
    return {
      apiKey: rawKey,
      message: 'Guarde esta chave em segurança. Ela não será exibida novamente.',
    }
  }

  async revokeApiKey(partnerId: string) {
    await this.prisma.partner.update({
      where: { id: partnerId },
      data: { apiKeyHash: null },
    })
    await this.audit.log({ action: 'partner.api_key_revoked', entityId: partnerId })
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────
  async getWebhooks(partnerId: string) {
    return this.prisma.partnerWebhook.findMany({ where: { partnerId } })
  }

  async createWebhook(partnerId: string, dto: CreateWebhookDto) {
    const VALID_EVENTS = [
      'redemption.created',
      'redemption.validated',
      'offer.expired',
      'commission.paid',
    ]
    const invalid = dto.events.filter(e => !VALID_EVENTS.includes(e))
    if (invalid.length) {
      throw new BadRequestException(`Eventos inválidos: ${invalid.join(', ')}. Válidos: ${VALID_EVENTS.join(', ')}`)
    }

    const secret = crypto.randomBytes(32).toString('hex')

    return this.prisma.partnerWebhook.create({
      data: {
        partnerId,
        url: dto.url,
        secret,
        events: dto.events,
      },
    })
  }

  async deleteWebhook(partnerId: string, webhookId: string) {
    const wh = await this.prisma.partnerWebhook.findUnique({ where: { id: webhookId } })
    if (!wh || wh.partnerId !== partnerId) throw new NotFoundException()
    await this.prisma.partnerWebhook.delete({ where: { id: webhookId } })
  }

  // ── Transações / Comissões ────────────────────────────────────────────────
  async getTransactions(partnerId: string) {
    return this.prisma.transaction.findMany({
      where: { partnerId },
      include: {
        user: { select: { name: true } },
        offer: { select: { title: true, discount: true } },
        commission: { select: { amount: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async validateCode(partnerId: string, code: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { code },
      include: {
        offer: true,
        user: { select: { name: true } },
      },
    })

    if (!tx) throw new NotFoundException('Código não encontrado')
    if (tx.partnerId !== partnerId) throw new ForbiddenException('Código de outro parceiro')
    if (tx.status === 'VALIDATED') throw new BadRequestException('Código já utilizado')
    if (tx.status === 'EXPIRED' || tx.expiresAt < new Date()) {
      throw new BadRequestException('Código expirado')
    }

    // Valida a transação
    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: { status: 'VALIDATED', validatedAt: new Date() },
    })

    // Atualiza economia total do usuário
    await this.prisma.user.update({
      where: { id: tx.userId },
      data: { totalSavings: { increment: Number(tx.savingsAmount) } },
    })

    await this.audit.log({
      action: 'transaction.validated',
      entity: 'Transaction',
      entityId: tx.id,
    })

    return {
      valid: true,
      customer: tx.user.name,
      offer: tx.offer.title,
      discount: tx.discount,
      finalAmount: Number(tx.finalAmount),
      savingsAmount: Number(tx.savingsAmount),
      validatedAt: new Date().toISOString(),
    }
  }

  private safePartner(partner: any) {
    const { passwordHash, apiKeyHash, ...safe } = partner
    return safe
  }
}
