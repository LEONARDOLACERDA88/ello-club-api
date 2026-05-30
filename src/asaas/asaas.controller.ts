import {
  Controller, Post, Get, Body, Headers, Req,
  UseGuards, UnauthorizedException, Logger,
} from '@nestjs/common'
import type { Request } from 'express'
import { AsaasService, PlanKey } from './asaas.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'

@Controller('api/asaas')
export class AsaasController {
  private readonly logger = new Logger(AsaasController.name)

  constructor(private readonly svc: AsaasService) {}

  // ── Criar assinatura (usuário logado) ─────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: any,
    @Body() body: {
      planKey: PlanKey
      billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
      cpf: string
      phone?: string
    },
  ) {
    // Cria/busca cliente no Asaas
    const customerId = await this.svc.upsertCustomer({
      userId: user.id,
      name: user.name,
      email: user.email,
      cpf: body.cpf,
      phone: body.phone,
    })

    // Cria assinatura
    const result = await this.svc.createSubscription({
      userId: user.id,
      customerId,
      planKey: body.planKey,
      billingType: body.billingType,
    })

    // Registra lead como "selected_plan"
    await this.svc.trackLeadEvent({
      userId: user.id,
      email: user.email,
      name: user.name,
      event: 'selected_plan',
      planKey: body.planKey,
    })

    return result
  }

  // ── Rastrear visita ao /planos ─────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('track-lead')
  async trackLead(
    @CurrentUser() user: any,
    @Body() body: {
      event: 'viewed_plans' | 'abandoned_checkout'
      planKey?: string
    },
  ) {
    await this.svc.trackLeadEvent({
      userId: user.id,
      email: user.email,
      name: user.name,
      event: body.event,
      planKey: body.planKey,
    })
    return { ok: true }
  }

  // ── Webhook do Asaas (sem auth — validado por token) ──────────────────────
  @Post('webhook')
  async webhook(
    @Headers('asaas-access-token') token: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN
    if (expected && token !== expected) {
      this.logger.warn(`Webhook Asaas com token inválido: ${token}`)
      throw new UnauthorizedException('Token inválido')
    }

    const event = body.event as string
    const payment = body.payment

    if (!event || !payment) return { ok: true }

    // Processa de forma assíncrona para responder rápido ao Asaas
    setImmediate(() => {
      this.svc.processWebhook(event, payment).catch(err =>
        this.logger.error(`Erro processando webhook ${event}:`, err),
      )
    })

    return { ok: true }
  }

  // ── Stats de assinaturas (admin) ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats() {
    return this.svc.getStats()
  }
}
