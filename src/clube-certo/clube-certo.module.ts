import { Module } from '@nestjs/common'
import { ClubeCertoController } from './clube-certo.controller'
import { ClubeCertoService } from './clube-certo.service'

@Module({
  controllers: [ClubeCertoController],
  providers: [ClubeCertoService],
  exports: [ClubeCertoService],
})
export class ClubeCertoModule {}
