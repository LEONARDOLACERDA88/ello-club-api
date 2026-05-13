import { Module } from '@nestjs/common'
import { OffersService } from './offers.service'
import { OffersController } from './offers.controller'
import { AuditService } from '../audit/audit.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  providers: [OffersService, AuditService],
  controllers: [OffersController],
})
export class OffersModule {}
