import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CryptoService } from '../common/crypto/crypto.service'
import { AuditService } from '../audit/audit.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private audit: AuditService,
  ) {}

  // ── Cadastro ──────────────────────────────────────────────────────────────
  async register(dto: {
    name: string
    email: string
    password: string
    phone?: string
    cpf?: string
    lgpdConsentIp: string
    lgpdConsentVersion: string
    marketingConsent?: boolean
  }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new ConflictException('E-mail já cadastrado')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const cpfEncrypted = dto.cpf ? this.crypto.encrypt(dto.cpf) : undefined

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone,
        cpfEncrypted,
        lgpdConsentAt: new Date(),
        lgpdConsentIp: dto.lgpdConsentIp,
        lgpdConsentVersion: dto.lgpdConsentVersion,
        marketingConsent: dto.marketingConsent ?? false,
      },
    })

    await this.audit.log({
      userId: user.id,
      action: 'user.registered',
      ipAddress: dto.lgpdConsentIp,
    })

    return this.safeUser(user)
  }

  // ── Perfil ────────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { favorites: { select: { offerId: true } } },
    })
    if (!user || user.deletedAt) throw new NotFoundException('Usuário não encontrado')

    return {
      ...this.safeUser(user),
      favorites: user.favorites.map(f => f.offerId),
    }
  }

  // ── Econômetro ────────────────────────────────────────────────────────────
  async getEconometro(userId: string) {
    const result = await this.prisma.transaction.aggregate({
      where: { userId, status: 'VALIDATED' },
      _sum: { savingsAmount: true },
      _count: true,
    })

    const totalSavings = Number(result._sum.savingsAmount ?? 0)
    const redemptions = result._count

    const level =
      totalSavings >= 1000 ? 'DIAMOND' :
      totalSavings >= 500  ? 'GOLD' :
      totalSavings >= 200  ? 'SILVER' : 'CLASSIC'

    const nextLevel = { CLASSIC: 200, SILVER: 500, GOLD: 1000, DIAMOND: null }[level]

    // Atualiza nível no banco
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalSavings, level: level as any },
    })

    return {
      totalSavings,
      level,
      redemptions,
      nextLevelAt: nextLevel,
      progressPercent: nextLevel
        ? Math.min(100, Math.round((totalSavings / nextLevel) * 100))
        : 100,
    }
  }

  // ── Favoritos ─────────────────────────────────────────────────────────────
  async toggleFavorite(userId: string, offerId: string) {
    const existing = await this.prisma.userFavorite.findUnique({
      where: { userId_offerId: { userId, offerId } },
    })

    if (existing) {
      await this.prisma.userFavorite.delete({
        where: { userId_offerId: { userId, offerId } },
      })
    } else {
      await this.prisma.userFavorite.create({ data: { userId, offerId } })
    }

    const favorites = await this.prisma.userFavorite.findMany({
      where: { userId },
      select: { offerId: true },
    })

    return { added: !existing, favorites: favorites.map(f => f.offerId) }
  }

  // ── Pontos ────────────────────────────────────────────────────────────────
  async getPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true, totalSavings: true },
    })
    return {
      points: user?.points ?? 0,
      totalSavings: Number(user?.totalSavings ?? 0),
    }
  }

  // ── LGPD — Exportação de dados ────────────────────────────────────────────
  async exportData(userId: string, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        transactions: true,
        favorites: true,
        notifications: true,
      },
    })
    if (!user) throw new NotFoundException()

    // Registra requisição LGPD
    await this.prisma.lgpdRequest.create({
      data: { userId, type: 'DATA_EXPORT', status: 'processing' },
    })
    await this.audit.log({ userId, action: 'user.lgpd_export', ipAddress: ip })

    // Retorna dados sem campos sensíveis internos
    const { passwordHash, cpfEncrypted, mfaSecret, ...safeData } = user
    return {
      exportedAt: new Date().toISOString(),
      data: {
        ...safeData,
        cpf: cpfEncrypted ? '****.***.***-**' : null, // não exporta CPF real
      },
    }
  }

  // ── LGPD — Exclusão de conta ──────────────────────────────────────────────
  async deleteAccount(userId: string, ip: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted_${userId}@ello.deleted`,
        name: 'Usuário Removido',
        phone: null,
        cpfEncrypted: null,
        status: 'INACTIVE',
      },
    })

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    })

    await this.prisma.lgpdRequest.create({
      data: { userId, type: 'DATA_DELETION', status: 'done' },
    })

    await this.audit.log({ userId, action: 'user.account_deleted', ipAddress: ip })
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  async getHistory(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      include: {
        offer: { select: { title: true, category: true, image: true } },
        partner: { select: { name: true, logo: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return transactions
  }

  private safeUser(user: any) {
    const { passwordHash, cpfEncrypted, mfaSecret, ...safe } = user
    return safe
  }
}
