import { Controller, Post, Body, Req, HttpCode } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login/user')
  @HttpCode(200)
  loginUser(@Body() body: { email: string; password: string }, @Req() req: Request) {
    return this.auth.loginUser(body.email, body.password, req.ip, req.headers['user-agent'])
  }

  @Post('login/partner')
  @HttpCode(200)
  loginPartner(@Body() body: { email: string; password: string }, @Req() req: Request) {
    return this.auth.loginPartner(body.email, body.password, req.ip, req.headers['user-agent'])
  }

  @Post('login/admin')
  @HttpCode(200)
  loginAdmin(@Body() body: { email: string; password: string }, @Req() req: Request) {
    return this.auth.loginAdmin(body.email, body.password, req.ip)
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: { refreshToken: string }, @Req() req: Request) {
    return this.auth.refreshTokens(body.refreshToken, req.ip)
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Body() body: { refreshToken: string }) {
    return this.auth.logout(body.refreshToken)
  }
}
