import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<string[]>('types', [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!requiredTypes) return true

    const { user } = ctx.switchToHttp().getRequest()
    if (!requiredTypes.includes(user?.type)) {
      throw new ForbiddenException('Acesso negado para este tipo de conta')
    }
    return true
  }
}
