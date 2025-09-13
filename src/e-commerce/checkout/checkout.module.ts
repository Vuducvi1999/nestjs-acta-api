import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PublicCartModule } from '../../public/carts/public-cart.module';
import { PrismaService } from '../../common/services/prisma.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PublicCartModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PrismaService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
