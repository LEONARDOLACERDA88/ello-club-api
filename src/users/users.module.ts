import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { UsersController, UsersPublicController } from './users.controller'
import { CryptoService } from '../common/crypto/crypto.service'
import { AuditService } from '../audit/audit.service'

@Module({
  providers: [UsersService, CryptoService, AuditService],
  controllers: [UsersPublicController, UsersController],
  exports: [UsersService],
})
export class UsersModule {}
