import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read the roles required by @Roles() on this route
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator on this route — any authenticated user is allowed
    if (!requiredRoles) {
      return true;
    }

    // user is attached to request by JwtAuthGuard via JwtStrategy.validate()
    const { user } = context.switchToHttp().getRequest();

    return requiredRoles.includes(user?.role);
  }
}
