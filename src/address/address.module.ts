import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [AddressController],
  providers: [AddressService, PrismaService],
  exports: [AddressService],
})
export class AddressModule {} 