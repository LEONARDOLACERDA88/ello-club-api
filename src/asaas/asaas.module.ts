import { Module } from '@nestjs/common'
import { AsaasService } from './asaas.service'
import { AsaasController } from './asaas.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { ClubeCertoModule } from '../clube-certo/clube-certo.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PrismaModule, ClubeCertoModule, NotificationsModule],
  controllers: [AsaasController],
  providers: [AsaasService],
  exports: [AsaasService],
})
export class AsaasModule {}
