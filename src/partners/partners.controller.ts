import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Req, UseGuards, HttpCode,
} from '@nestjs/common'
import type { Request } from 'express'
import { PartnersService } from './partners.service'
import { RegisterPartnerDto } from './dto/register-partner.dto'
import { CreateOfferDto } from './dto/create-offer.dto'
import { CreateWebhookDto } from './dto/create-webhook.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CurrentUser, RequireType } from '../common/decorators/current-user.decorator'

// ── Rotas públicas ────────────────────────────────────────────────────────────
@Controller('api/partners')
export class PartnersController {
  constructor(private partners: PartnersService) {}

  @Post('register')
  register(@Body() dto: RegisterPartnerDto, @Req() req: Request) {
    return this.partners.register(dto, req.ip)
  }

  // ── Rotas autenticadas (parceiro logado) ──────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  getProfile(@CurrentUser('id') partnerId: string) {
    return this.partners.getProfile(partnerId)
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  getDashboard(@CurrentUser('id') partnerId: string) {
    return this.partners.getDashboard(partnerId)
  }

  // ── Ofertas ───────────────────────────────────────────────────────────────

  @Get('offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  getOffers(@CurrentUser('id') partnerId: string) {
    return this.partners.getOffers(partnerId)
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  createOffer(@CurrentUser('id') partnerId: string, @Body() dto: CreateOfferDto) {
    return this.partners.createOffer(partnerId, dto)
  }

  @Put('offers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  updateOffer(
    @CurrentUser('id') partnerId: string,
    @Param('id') offerId: string,
    @Body() dto: Partial<CreateOfferDto>,
  ) {
    return this.partners.updateOffer(partnerId, offerId, dto)
  }

  @Delete('offers/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  deleteOffer(@CurrentUser('id') partnerId: string, @Param('id') offerId: string) {
    return this.partners.deleteOffer(partnerId, offerId)
  }

  // ── API Key B2B ───────────────────────────────────────────────────────────

  @Post('api-key/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  generateApiKey(@CurrentUser('id') partnerId: string) {
    return this.partners.generateApiKey(partnerId)
  }

  @Delete('api-key/revoke')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  revokeApiKey(@CurrentUser('id') partnerId: string) {
    return this.partners.revokeApiKey(partnerId)
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  @Get('webhooks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  getWebhooks(@CurrentUser('id') partnerId: string) {
    return this.partners.getWebhooks(partnerId)
  }

  @Post('webhooks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  createWebhook(@CurrentUser('id') partnerId: string, @Body() dto: CreateWebhookDto) {
    return this.partners.createWebhook(partnerId, dto)
  }

  @Delete('webhooks/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  deleteWebhook(@CurrentUser('id') partnerId: string, @Param('id') webhookId: string) {
    return this.partners.deleteWebhook(partnerId, webhookId)
  }

  // ── Transações e validação de código no PDV ───────────────────────────────

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  getTransactions(@CurrentUser('id') partnerId: string) {
    return this.partners.getTransactions(partnerId)
  }

  @Post('validate/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('partner')
  validateCode(@CurrentUser('id') partnerId: string, @Param('code') code: string) {
    return this.partners.validateCode(partnerId, code)
  }
}
