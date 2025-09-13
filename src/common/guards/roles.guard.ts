import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { PrismaService } from '../services/prisma.service';

/*
    - Get list roles from metadata
    - If no roles are defined, allow access
    - Get data user from request
    - Get user groups from conito:groups in token
    - Check if the user has the appropriate permissions for the required role
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector, //get metadata (role) from decorators
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    //Get list roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    //If no roles are defined, allow access
    if (!requiredRoles) {
      return true;
    }
    //Get data user from request
    const user = request.user;

    // Get user role
    const userRole = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        role: true,
      },
    });

    // Check exist user
    if (!userRole) {
      throw new UnauthorizedException('User not found');
    }

    //Check if user is SUPER_ADMIN, bypass other checks
    if (userRole.role === Role.ADMIN) {
      return true;
    }

    //Check if the user has the appropriate permissions for the required role
    const hasRole = requiredRoles.some((role) => userRole.role === role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
