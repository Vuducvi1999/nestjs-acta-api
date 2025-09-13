import { Module } from '@nestjs/common';
import { AffiliateCommissionService } from './affiliate-commission.service';
import { AffiliateCommissionController } from './affiliate-commission.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [AffiliateCommissionController],
  providers: [AffiliateCommissionService, PrismaService],
  exports: [AffiliateCommissionService],
})
export class AffiliateModule {}
