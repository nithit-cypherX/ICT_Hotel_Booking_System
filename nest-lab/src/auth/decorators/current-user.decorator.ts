import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage: @CurrentUser() user — gives you the user object attached by JwtAuthGuard
// Contains: { id, username, role } as returned by JwtStrategy.validate()
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
