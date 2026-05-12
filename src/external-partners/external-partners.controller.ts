import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, UseGuards, HttpCode,
} from '@nestjs/common'
import type { Request } from 'express'
import { ExternalPartnersService } from './external-partners.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CurrentUser, RequireType } from '../common/decorators/current-user.decorator'

@Controller('api/external-partners')
export class ExternalPartnersController {
  constructor(private service: ExternalPartnersService) {}

  // ── PÚBLICO ───────────────────────────────────────────────────────────────

  @Get()
  findAll(@Query() q: { category?: string; source?: string; integrationType?: string }) {
    return this.service.findAll(q)
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('admin')
  getStats() {
    return this.service.getStats()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  // ── RASTREAMENTO ──────────────────────────────────────────────────────────

  @Post(':id/click')
  @HttpCode(200)
  trackClick(
    @Param('id') partnerId: string,
    @Body() body: { sessionId?: string },
    @Req() req: Request,
    @CurrentUser('id') userId?: string,
  ) {
    const ip = req.ip
    const ua = req.headers['user-agent']
    return this.service.trackClick(partnerId, userId, body.sessionId, ip, ua)
  }

  @Post(':id/postback')
  @HttpCode(200)
  receivePostback(
    @Param('id') partnerId: string,
    @Body() body: { clickId?: string; sessionId?: string; savingsAmount: number; secret: string },
  ) {
    return this.service.receivePostback(partnerId, body)
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('admin')
  create(@Body() body: any) {
    return this.service.create(body)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('admin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Post('import/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('admin')
  importBulk(@Body() body: { partners: any[] }) {
    return this.service.importBulk(body.partners)
  }
}
