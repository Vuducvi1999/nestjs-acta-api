import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/services/prisma.service';
import { JwtPayload } from '../jwt-payload';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../common/configs/types/index.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AllConfigType>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('app.jwtSecretKey', {
        infer: true,
      }),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user || !user.verificationDate) {
      throw new UnauthorizedException('Access Denied');
    }

    return user;
  }
}
