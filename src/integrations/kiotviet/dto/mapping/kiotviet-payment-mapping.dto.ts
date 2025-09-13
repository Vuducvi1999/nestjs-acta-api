import { OriginSource, PaymentMethod, PaymentStatus } from '@prisma/client';
import { KiotVietBankAccountMapping } from './kiotviet-bankaccount-mapping.dto';
import { KiotVietInvoiceMapping } from './kiotviet-invoice-mapping.dto';

export class KiotVietPaymentMapping {
  id: string;
  code: string;

  kiotVietPaymentId?: number;
  kiotVietAccountId?: number;

  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transDate: Date;
  bankAccount: string;
  description?: string;
  source: OriginSource;

  account?: KiotVietBankAccountMapping;

  invoice?: KiotVietInvoiceMapping;

  createdAt: Date;
  updatedAt: Date;
}
