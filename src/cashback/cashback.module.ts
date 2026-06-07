import { Module } from '@nestjs/common'
import { CashbackService } from './cashback.service'
import { CashbackController } from './cashback.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AsaasModule } from '../asaas/asaas.module'

@Module({
  imports: [PrismaModule, NotificationsModule, AsaasModule],
  controllers: [CashbackController],
  providers: [CashbackService],
  exports: [CashbackService],
})
export class CashbackModule {}
