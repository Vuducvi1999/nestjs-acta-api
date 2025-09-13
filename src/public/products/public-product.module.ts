import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicProductController } from './public-product.controller';
import { PublicProductService } from './public-product.service';

@Module({
  providers: [PrismaService, PublicProductService],
  exports: [PublicProductService],
  controllers: [PublicProductController],
})
export class PublicProductModule {}
