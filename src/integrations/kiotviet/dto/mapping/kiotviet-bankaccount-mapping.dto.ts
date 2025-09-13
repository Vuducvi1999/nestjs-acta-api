import { OriginSource } from "@prisma/client";
import { KiotVietPaymentMapping } from "./kiotviet-payment-mapping.dto";

export class KiotVietBankAccountMapping {
  id: string;

  kiotVietBankAccountId?: number;

  bankName: string;
  accountNumber: string;
  description: string;

  source: OriginSource;

  invoicePayments: KiotVietPaymentMapping[];
}