import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  // ── Login usuário ─────────────────────────────────────────────────────────
  async loginUser(email: string, password: string, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || user.deletedAt) throw new UnauthorizedException('Credenciais inválidas')
    if (user.status === 'SUSPENDED') throw new ForbiddenException('Conta suspensa')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')

    await this.audit.log({ userId: user.id, action: 'user.login', ipAddress: ip, userAgent: ua })

    const tokens = await this.generateTokens(user.id, 'user')
    return { tokens, user: this.safeUser(user) }
  }

  // ── Login parceiro ────────────────────────────────────────────────────────
  async loginPartner(email: string, password: string, ip?: string, ua?: string) {
    const partner = await this.prisma.partner.findUnique({ where: { email } })
    if (!partner) throw new UnauthorizedException('Credenciais inválidas')
    if (partner.status === 'SUSPENDED') throw new ForbiddenException('Conta suspensa')

    const valid = await bcrypt.compare(password, partner.passwordHash)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')

    await this.audit.log({ action: 'partner.login', entityId: partner.id, ipAddress: ip, userAgent: ua })

    const tokens = await this.generateTokens(partner.id, 'partner')
    return { tokens, partner: this.safePartner(partner) }
  }

  // ── Login admin ───────────────────────────────────────────────────────────
  async loginAdmin(email: string, password: string, ip?: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email } })
    if (!admin) throw new UnauthorizedException('Credenciais inválidas')

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')

    await this.audit.log({ action: 'admin.login', entityId: admin.id, ipAddress: ip })

    const tokens = await this.generateTokens(admin.id, 'admin')
    return { tokens, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } }
  }

  // ── Refresh token ─────────────────────────────────────────────────────────
  async refreshTokens(refreshToken: string, ip?: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado')
    }

    // Rotação: revoga o token atual e gera um novo
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })

    const tokens = await this.generateTokens(stored.userId, 'user')
    await this.audit.log({ userId: stored.userId, action: 'user.token_refresh', ipAddress: ip })
    return tokens
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async generateTokens(subjectId: string, type: 'user' | 'partner' | 'admin') {
    const accessToken = this.jwt.sign({ sub: subjectId, type })

    const rawRefresh = crypto.randomBytes(64).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    if (type === 'user') {
      await this.prisma.refreshToken.create({
        data: { userId: subjectId, tokenHash, expiresAt },
      })
    }

    return { accessToken, refreshToken: rawRefresh, expiresIn: 900 }
  }

  private safeUser(user: any) {
    const { passwordHash, cpfEncrypted, mfaSecret, ...safe } = user
    return safe
  }

  private safePartner(partner: any) {
    const { passwordHash, apiKeyHash, ...safe } = partner
    return safe
  }
}
