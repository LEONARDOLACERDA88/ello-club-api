import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { OffersModule } from './offers/offers.module'
import { PartnersModule } from './partners/partners.module'
import { AdminModule } from './admin/admin.module'
import { ExternalPartnersModule } from './external-partners/external-partners.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    OffersModule,
    PartnersModule,
    AdminModule,
    ExternalPartnersModule,
    NotificationsModule,
  ],
  providers: [
    // Aplica rate limiting em todas as rotas
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
