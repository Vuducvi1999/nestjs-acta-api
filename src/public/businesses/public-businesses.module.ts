import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicBusinessController } from './public-businesses.controller';
import { PublicBusinessService } from './public-businesses.service';

@Module({
  providers: [PrismaService, PublicBusinessService],
  exports: [PublicBusinessService],
  controllers: [PublicBusinessController],
})
export class PublicBusinessModule {}
