import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const KiotVietApiKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const apiKey = request.headers['x-kiotviet-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    return apiKey;
  },
);
