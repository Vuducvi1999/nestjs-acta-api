import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../common/services/prisma.service';
import { MailModule } from '../mail/mail.module';
import { JwtStrategy } from './jwt-atoken.strategy';
import { JwtRefreshTokenStrategy } from './jwt-rtoken.strategy';
import { UserModule } from '../users/users.module';
import { NotificationModule } from '../notifications/notification.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllConfigType } from '../common/configs/types/index.type';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { UserConfigService } from '../users/users-config.service';
import { AuthGateway } from './auth.gateway';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AllConfigType>) => {
        return {
          max: 100,
          ttl: 1000 * 60 * 5, // 5 minutes,
          isGlobal: true,
        };
      },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AllConfigType>) => ({
        secret: config.getOrThrow('app.jwtSecretKey', { infer: true }),
        signOptions: {
          expiresIn: '1000h', // 1000 hours (matches access token)
        },
      }),
      global: true,
    }),
    MailModule,
    UserModule,
    NotificationModule,
  ],
  providers: [
    UserConfigService,
    AuthService,
    PrismaService,
    JwtStrategy,
    ActivityLogService,
    JwtRefreshTokenStrategy,
    JwtAuthGuard,
    AuthGateway,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
