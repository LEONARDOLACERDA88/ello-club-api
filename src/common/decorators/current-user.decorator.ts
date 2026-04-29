import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user
    return data ? user?.[data] : user
  },
)

export const RequireType = (...types: string[]) => {
  const SetMetadata = require('@nestjs/common').SetMetadata
  return SetMetadata('types', types)
}
