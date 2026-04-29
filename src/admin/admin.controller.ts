import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common'
import { AdminService } from './admin.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { CurrentUser, RequireType } from '../common/decorators/current-user.decorator'

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireType('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.admin.getDashboard()
  }

  // ── Parceiros ─────────────────────────────────────────────────────────────

  @Get('partners')
  getPartners(@Query('status') status?: string) {
    return this.admin.getPartners(status)
  }

  @Put('partners/:id/approve')
  approvePartner(@CurrentUser('id') adminId: string, @Param('id') partnerId: string) {
    return this.admin.approvePartner(adminId, partnerId)
  }

  @Put('partners/:id/suspend')
  suspendPartner(
    @CurrentUser('id') adminId: string,
    @Param('id') partnerId: string,
    @Body() body: { reason?: string },
  ) {
    return this.admin.suspendPartner(adminId, partnerId, body.reason)
  }

  // ── Usuários ──────────────────────────────────────────────────────────────

  @Get('users')
  getUsers(@Query('page') page?: string) {
    return this.admin.getUsers(page ? parseInt(page) : 1)
  }

  @Put('users/:id/status')
  updateUserStatus(
    @CurrentUser('id') adminId: string,
    @Param('id') userId: string,
    @Body() body: { status: string },
  ) {
    return this.admin.updateUserStatus(adminId, userId, body.status)
  }

  // ── Comissões ─────────────────────────────────────────────────────────────

  @Get('commissions')
  getCommissions(@Query('status') status?: string) {
    return this.admin.getCommissions(status)
  }

  @Post('commissions/pay/:partnerId')
  payCommissions(@CurrentUser('id') adminId: string, @Param('partnerId') partnerId: string) {
    return this.admin.payCommissions(adminId, partnerId)
  }

  // ── Relatórios ────────────────────────────────────────────────────────────

  @Get('reports')
  getReports() {
    return this.admin.getReports()
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  @Get('audit-logs')
  getAuditLogs(@Query('page') page?: string) {
    return this.admin.getAuditLogs(page ? parseInt(page) : 1)
  }

  // ── Setup inicial (criar primeiro admin) ──────────────────────────────────
  // Esta rota não tem @UseGuards — usada apenas uma vez no setup
}

// Rota pública separada para criar o primeiro admin
import { Controller as C2, Post as P2, Body as B2 } from '@nestjs/common'

@C2('api/admin/setup')
export class AdminSetupController {
  constructor(private admin: AdminService) {}

  @P2()
  @HttpCode(201)
  setup(@B2() body: { email: string; password: string; name: string; setupSecret: string }) {
    if (body.setupSecret !== process.env.ADMIN_SETUP_SECRET) {
      throw new Error('Setup secret inválido')
    }
    return this.admin.createFirstAdmin(body.email, body.password, body.name)
  }
}
