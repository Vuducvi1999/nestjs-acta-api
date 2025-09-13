import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../common/configs/types/index.type';
import { PrismaService } from '../../common/services/prisma.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { IS_EXTERNAL_APP_KEY } from '../../common/decorators/external-app.decorator';
import { JwtPayload } from '../jwt-payload';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { tokenCacheKey } from '../auth-utils';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const route = `${request.method} ${request.url}`;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isExternalApp = this.reflector.getAllAndOverride<boolean>(
      IS_EXTERNAL_APP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic || isExternalApp) {
      return true;
    }

    const response = context.switchToHttp().getResponse();

    // Add cache control headers
    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.setHeader('Surrogate-Control', 'no-store');

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const keyRead = tokenCacheKey(token);
      const cachedUser = await this.cacheManager.get(keyRead);
      if (cachedUser) {
        request.user = cachedUser;
        return true;
      }

      const payload: JwtPayload & { iat: number; exp: number } =
        await this.jwtService.verifyAsync(token, {
          secret: this.configService.getOrThrow('app.jwtSecretKey', {
            infer: true,
          }),
        });

      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        throw new TokenExpiredError(
          'Token expired',
          new Date(payload.exp * 1000),
        );
      }

      const existUser = await this.prisma.user.findUnique({
        where: {
          id: payload.id,
          deletedAt: null,
          verificationDate: {
            not: null,
          },
        },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          referenceId: true,
        },
      });

      if (!existUser) {
        throw new UnauthorizedException('User not found');
      }

      request.user = {
        ...existUser,
        accessToken: token,
        iat: payload.iat,
        exp: payload.exp,
      };

      const keyWrite = tokenCacheKey(token);
      await this.cacheManager.set(keyWrite, request.user, 1000 * 5);

      return true;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new HttpException('Token expired', HttpStatus.GONE);
      }
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer') {
      return undefined;
    }

    return token;
  }
}
