import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicBusinessController } from './public-business.controller';
import { PublicBusinessService } from './public-business.service';

@Module({
  providers: [PrismaService, PublicBusinessService],
  exports: [PublicBusinessService],
  controllers: [PublicBusinessController],
})
export class PublicBusinessModule {}
