import {
  Controller, Get, Post, Body, Headers, UseGuards, Logger, UnauthorizedException,
} from '@nestjs/common'
import { CashbackService } from './cashback.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'

@Controller('api/cashback')
export class CashbackController {
  private readonly logger = new Logger(CashbackController.name)

  constructor(private readonly svc: CashbackService) {}

  // ── Carteira do usuário logado ────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('wallet')
  getWallet(@CurrentUser() user: any) {
    return this.svc.getWallet(user.id)
  }

  // ── Solicitar saque ───────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  requestWithdrawal(
    @CurrentUser() user: any,
    @Body() body: { pixKey: string },
  ) {
    if (!body.pixKey?.trim()) {
      throw new UnauthorizedException('Chave PIX obrigatória')
    }
    return this.svc.requestWithdrawal(user.id, body.pixKey.trim())
  }

  // ── Webhook Lomadee ───────────────────────────────────────────────────────
  // URL para configurar na Lomadee: POST /api/cashback/webhook/lomadee
  // Header de segurança: x-lomadee-token = process.env.LOMADEE_WEBHOOK_TOKEN
  @Post('webhook/lomadee')
  async webhookLomadee(
    @Headers('x-lomadee-token') token: string,
    @Body() body: any,
  ) {
    const expected = process.env.LOMADEE_WEBHOOK_TOKEN
    if (expected && token !== expected) {
      this.logger.warn('Lomadee webhook com token inválido')
      throw new UnauthorizedException('Token inválido')
    }
    setImmediate(() =>
      this.svc.processLomadeeWebhook(body).catch(err =>
        this.logger.error('Erro processando webhook Lomadee:', err),
      )
    )
    return { ok: true }
  }

  // ── Webhook Clube Certo ───────────────────────────────────────────────────
  // URL para configurar no Clube Certo: POST /api/cashback/webhook/clube-certo
  // Header de segurança: x-clube-certo-token = process.env.CLUBE_CERTO_WEBHOOK_TOKEN
  @Post('webhook/clube-certo')
  async webhookClubeCerto(
    @Headers('x-clube-certo-token') token: string,
    @Body() body: any,
  ) {
    const expected = process.env.CLUBE_CERTO_WEBHOOK_TOKEN
    if (expected && token !== expected) {
      this.logger.warn('Clube Certo webhook com token inválido')
      throw new UnauthorizedException('Token inválido')
    }
    setImmediate(() =>
      this.svc.processClubeCertoWebhook(body).catch(err =>
        this.logger.error('Erro processando webhook Clube Certo:', err),
      )
    )
    return { ok: true }
  }

  // ── Webhook Afilio ────────────────────────────────────────────────────────
  // URL para configurar na Afilio: POST /api/cashback/webhook/afilio
  // Header de segurança: x-afilio-token = process.env.AFILIO_WEBHOOK_TOKEN
  @Post('webhook/afilio')
  async webhookAfilio(
    @Headers('x-afilio-token') token: string,
    @Body() body: any,
  ) {
    const expected = process.env.AFILIO_WEBHOOK_TOKEN
    if (expected && token !== expected) {
      this.logger.warn('Afilio webhook com token inválido')
      throw new UnauthorizedException('Token inválido')
    }
    setImmediate(() =>
      this.svc.processAfilioWebhook(body).catch(err =>
        this.logger.error('Erro processando webhook Afilio:', err),
      )
    )
    return { ok: true }
  }

  // ── Admin: criar cashback manual ──────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('admin/manual')
  createManual(
    @Body() body: {
      userId: string
      storeName: string
      source: string
      purchaseAmount: number
      commissionValue: number
      status?: 'PENDING' | 'CONFIRMED'
    },
  ) {
    return this.svc.createManual(body)
  }

  // ── Admin: stats ──────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('admin/stats')
  getAdminStats() {
    return this.svc.getAdminStats()
  }
}
