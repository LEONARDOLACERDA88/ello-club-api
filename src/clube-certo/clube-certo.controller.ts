import { Controller, Get, Post, Patch, Query, Param, UseGuards } from '@nestjs/common'
import { ClubeCertoService } from './clube-certo.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'

@Controller('api/clube-certo')
export class ClubeCertoController {
  constructor(private readonly svc: ClubeCertoService) {}

  // ── Admin: disparar sync manual ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('sync')
  sync() {
    return this.svc.syncAll()
  }

  // ── Admin: stats gerais ───────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  stats() {
    return this.svc.getStats()
  }

  // ── Admin: listar todos com filtros ───────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('admin/list')
  listAdmin(
    @Query('source') source?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.listForAdmin({ source, category, status, search })
  }

  // ── Admin: toggle ativo/inativo ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch('toggle/:id')
  toggle(@Param('id') id: string) {
    return this.svc.toggleStatus(id)
  }

  // ── Usuário: link personalizado com CPF rastreado (cashback) ──────────────
  @UseGuards(JwtAuthGuard)
  @Get('link/:id')
  getLink(@Param('id') id: string, @CurrentUser() user: any) {
    const cpf = user.cpf || '00000000000'
    return this.svc.getPersonalizedLink(id, cpf).then(url => ({ url }))
  }

  // ── Público: listar parceiros ativos por categoria ────────────────────────
  @Get('partners')
  listPublic(
    @Query('category') category?: string,
    @Query('source') source?: string,
  ) {
    return this.svc.listForAdmin({
      source: source || undefined,
      category,
      status: 'active',
    })
  }
}
