import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [BusinessController],
  providers: [BusinessService, PrismaService],
  exports: [BusinessService],
})
export class BusinessModule {}
