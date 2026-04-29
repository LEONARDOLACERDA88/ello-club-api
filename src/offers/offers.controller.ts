import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { OffersService } from './offers.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser, RequireType } from '../common/decorators/current-user.decorator'
import { RolesGuard } from '../common/guards/roles.guard'

@Controller('api/offers')
export class OffersController {
  constructor(private offers: OffersService) {}

  @Get()
  findAll(@Query() query: { category?: string; search?: string; sort?: string }) {
    return this.offers.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.offers.findOne(id)
  }

  @Post(':id/redeem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireType('user')
  redeem(@Param('id') offerId: string, @CurrentUser('id') userId: string, @Req() req: Request) {
    return this.offers.redeem(userId, offerId, req.ip)
  }
}
