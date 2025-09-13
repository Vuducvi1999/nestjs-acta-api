import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../common/services/prisma.service';

@Injectable()
export class IntegrationHelper {
  constructor(private readonly prisma: PrismaService) {}

  async validateAndGetUserRole(user: JwtPayload): Promise<Role> {
    const existenceUser = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        role: true,
      },
    });

    if (!existenceUser) {
      throw new UnauthorizedException('Access denied');
    }

    return existenceUser.role;
  }
}