import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicCategoryController } from './public-category.controller';
import { PublicCategoryService } from './public-category.service';

@Module({
  providers: [PrismaService, PublicCategoryService],
  exports: [PublicCategoryService],
  controllers: [PublicCategoryController],
})
export class PublicCategoryModule {}
