import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as webpush from 'web-push'

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(private prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const email = process.env.VAPID_EMAIL || 'contato@elloclubmais.com.br'

    if (publicKey && privateKey) {
      webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey)
    }
  }

  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || ''
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { auth: string; p256dh: string } },
    userAgent?: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId,
        endpoint: sub.endpoint,
        auth: sub.keys.auth,
        p256dh: sub.keys.p256dh,
        userAgent,
      },
      update: {
        userId,
        auth: sub.keys.auth,
        p256dh: sub.keys.p256dh,
        userAgent,
      },
    })
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    })
  }

  // ── Envio ────────────────────────────────────────────────────────────────────

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; icon?: string },
  ) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } })

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/home',
      icon: payload.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })

    await Promise.allSettled(
      subs.map(sub =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
            pushPayload,
          )
          .catch(async err => {
            // Subscription expirou — remove
            if (err.statusCode === 410 || err.statusCode === 404) {
              await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
            }
            this.logger.warn(`Push falhou para sub ${sub.id}: ${err.message}`)
          }),
      ),
    )

    // Salva notificacao in-app também
    await this.prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        type: 'push',
        data: { url: payload.url || '/home' },
      },
    })
  }

  async broadcast(
    payload: { title: string; body: string; url?: string },
    targetLevel?: string,
  ): Promise<{ sent: number }> {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(targetLevel ? { level: targetLevel as any } : {}),
      },
      select: { id: true },
    })

    let sent = 0
    for (const u of users) {
      await this.sendToUser(u.id, payload).catch(() => {})
      sent++
    }
    return { sent }
  }

  // ── In-app notifications ─────────────────────────────────────────────────────

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } })
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    })
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  }
}
