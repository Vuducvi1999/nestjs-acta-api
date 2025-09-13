import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_EXTERNAL_APP_KEY } from '../decorators/external-app.decorator';

@Injectable()
export class ExternalAppGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const route = `${request.method} ${request.url}`;

    const isExternalApp = this.reflector.getAllAndOverride<boolean>(
      IS_EXTERNAL_APP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isExternalApp) {
      return true; // Not an external app endpoint, skip this guard
    }

    // Extract API key from headers
    const authorization = request.headers.authorization;
    const xApiKey = request.headers['x-api-key'];
    
    let providedApiKey: string | undefined;

    if (authorization) {
      const [type, token] = authorization.split(' ');
      if (type === 'Apikey' && token) {
        providedApiKey = token;
      }
    }

    if (!providedApiKey && xApiKey) {
      providedApiKey = xApiKey;
    }

    const expectedApiKey = this.configService.get<string>('X_API_KEY');

    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
