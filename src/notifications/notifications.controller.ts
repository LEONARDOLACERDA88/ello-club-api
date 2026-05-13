import type { Request } from 'express'
import {
  Controller, Post, Delete, Get, Patch, Body, Param,
  Req, UseGuards,
} from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { RolesGuard } from '../common/guards/roles.guard'

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  // Público — frontend precisa da chave para montar a subscription
  @Get('vapid-key')
  vapidKey() {
    return { publicKey: this.svc.getVapidPublicKey() }
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(
    @CurrentUser() user: any,
    @Body() body: { endpoint: string; keys: { auth: string; p256dh: string } },
    @Req() req: Request,
  ) {
    return this.svc.subscribe(user.id, body, req.headers['user-agent'])
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscribe')
  unsubscribe(@CurrentUser() user: any, @Body() body: { endpoint: string }) {
    return this.svc.unsubscribe(user.id, body.endpoint)
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: any) {
    return this.svc.list(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.svc.unreadCount(user.id).then(count => ({ count }))
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.svc.markAllRead(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.markRead(user.id, id)
  }

  // Admin — dispara push para todos os usuários (ou por nível)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('broadcast')
  broadcast(
    @Body() body: { title: string; body: string; url?: string; level?: string },
  ) {
    return this.svc.broadcast(
      { title: body.title, body: body.body, url: body.url },
      body.level,
    )
  }
}
