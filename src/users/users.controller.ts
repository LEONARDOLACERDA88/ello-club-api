import { Controller, Get, Post, Delete, Param, Req, Body, UseGuards, HttpCode } from '@nestjs/common'
import type { Request } from 'express'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser, RequireType } from '../common/decorators/current-user.decorator'
import { RolesGuard } from '../common/guards/roles.guard'

// ── Rota pública: cadastro ────────────────────────────────────────────────────
@Controller('api/users')
export class UsersPublicController {
  constructor(private users: UsersService) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() body: {
    name: string
    email: string
    password: string
    phone?: string
    cpf?: string
    marketingConsent?: boolean
  }, @Req() req: Request) {
    return this.users.register({
      ...body,
      lgpdConsentIp: req.ip ?? 'unknown',
      lgpdConsentVersion: '1.0',
    })
  }
}

// ── Rotas protegidas ──────────────────────────────────────────────────────────
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireType('user')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId)
  }

  @Get('points')
  getPoints(@CurrentUser('id') userId: string) {
    return this.users.getPoints(userId)
  }

  @Get('econometro')
  getEconometro(@CurrentUser('id') userId: string) {
    return this.users.getEconometro(userId)
  }

  @Get('history')
  getHistory(@CurrentUser('id') userId: string) {
    return this.users.getHistory(userId)
  }

  @Post('favorites/:offerId')
  toggleFavorite(@CurrentUser('id') userId: string, @Param('offerId') offerId: string) {
    return this.users.toggleFavorite(userId, offerId)
  }

  // ── LGPD ──────────────────────────────────────────────────────────────────

  @Get('lgpd/export')
  exportData(@CurrentUser('id') userId: string, @Req() req: Request) {
    return this.users.exportData(userId, req.ip ?? '')
  }

  @Delete('lgpd/delete')
  @HttpCode(204)
  deleteAccount(@CurrentUser('id') userId: string, @Req() req: Request) {
    return this.users.deleteAccount(userId, req.ip ?? '')
  }
}
