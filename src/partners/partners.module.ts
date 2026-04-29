import { Module } from '@nestjs/common'
import { PartnersService } from './partners.service'
import { PartnersController } from './partners.controller'
import { CryptoService } from '../common/crypto/crypto.service'
import { AuditService } from '../audit/audit.service'

@Module({
  providers: [PartnersService, CryptoService, AuditService],
  controllers: [PartnersController],
  exports: [PartnersService],
})
export class PartnersModule {}
