import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AllConfigType } from '../configs/types/index.type';

export class CacheConfigService {
  static register() {
    return CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService<AllConfigType>) => ({
        url: configService.get<AllConfigType['redis']>('redis')?.redisUrl,
        ttl: 1000 * 60 * 2, // 2 minutes
      }),
      inject: [ConfigService],
    });
  }
}
