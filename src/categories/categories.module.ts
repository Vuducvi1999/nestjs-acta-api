import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  providers: [CategoriesService, PrismaService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
