import { Module } from '@nestjs/common'
import { AdminService } from './admin.service'
import { AdminController, AdminSetupController } from './admin.controller'
import { AuditService } from '../audit/audit.service'

@Module({
  providers: [AdminService, AuditService],
  controllers: [AdminController, AdminSetupController],
})
export class AdminModule {}
