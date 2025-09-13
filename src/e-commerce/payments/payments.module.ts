import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentsController } from './payments.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentsService } from './payments.service';
import { PaymentCronService } from './payment-cron.service';
import { PaymentConfigService } from './payment-config.service';
import { CashProvider } from './providers/cash.provider';
import { PrismaService } from '../../common/services/prisma.service';
import { RefundsService } from './refunds.service';
import { WebhookSignatureHelper } from './helpers/webhook-signature.helper';
import { PaymentsExternalController } from './payments-external.controller';
import { AffiliateQueueService } from './affiliate-queue.service';
import { PaymentsGateway } from './payments.gateway';
import { PaymentMonitoringService } from './payment-monitoring.service';
import { PaymentEventsService } from './payment-events.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    PaymentsController,
    PaymentWebhooksController,
    PaymentsExternalController,
  ],
  providers: [
    PaymentsService,
    PaymentCronService,
    PaymentConfigService,
    CashProvider,
    PrismaService,
    RefundsService,
    WebhookSignatureHelper,
    AffiliateQueueService,
    PaymentsGateway,
    PaymentMonitoringService,
    PaymentEventsService,
  ],
  exports: [PaymentsService, CashProvider, RefundsService, PaymentsGateway],
})
export class PaymentsModule {}
