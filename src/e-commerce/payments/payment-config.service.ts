import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../common/configs/types/index.type';

@Injectable()
export class PaymentConfigService {
  constructor(private configService: ConfigService<AllConfigType>) {}

  get PAYMENT_CRON_EVERY_MINUTES(): number {
    return (
      this.configService.get<AllConfigType['payment']>('payment')?.cron
        ?.everyMinutes || 5
    );
  }

  get PAYMENT_CRON_BATCH_SIZE(): number {
    return (
      this.configService.get<AllConfigType['payment']>('payment')?.cron
        ?.batchSize || 100
    );
  }

  get PAYMENT_WEBHOOK_SECRET(): string | undefined {
    return this.configService.get<AllConfigType['payment']>('payment')?.webhook
      ?.secret;
  }
}
