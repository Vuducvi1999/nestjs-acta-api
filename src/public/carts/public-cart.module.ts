import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicCartController } from './public-cart.controller';
import { PublicCartService } from './public-cart.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // maximum number of items in cache
    }),
  ],
  controllers: [PublicCartController],
  providers: [PrismaService, PublicCartService],
  exports: [PublicCartService],
})
export class PublicCartModule {}
