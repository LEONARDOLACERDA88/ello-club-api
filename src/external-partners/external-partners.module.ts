import { Module } from '@nestjs/common'
import { ExternalPartnersController } from './external-partners.controller'
import { ExternalPartnersService } from './external-partners.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ExternalPartnersController],
  providers: [ExternalPartnersService],
  exports: [ExternalPartnersService],
})
export class ExternalPartnersModule {}
