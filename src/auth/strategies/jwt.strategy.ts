import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string; type: 'user' | 'partner' | 'admin' }) {
    if (payload.type === 'user') {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user || user.deletedAt || user.status === 'SUSPENDED') throw new UnauthorizedException()
      return { id: user.id, type: 'user', status: user.status }
    }
    if (payload.type === 'partner') {
      const partner = await this.prisma.partner.findUnique({ where: { id: payload.sub } })
      if (!partner || partner.status === 'SUSPENDED') throw new UnauthorizedException()
      return { id: partner.id, type: 'partner', status: partner.status }
    }
    if (payload.type === 'admin') {
      const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } })
      if (!admin) throw new UnauthorizedException()
      return { id: admin.id, type: 'admin', role: admin.role }
    }
    throw new UnauthorizedException()
  }
}
