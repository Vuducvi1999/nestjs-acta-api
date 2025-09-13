import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for bank account information from KiotViet API
 * Used for endpoint: GET /BankAccounts
 */
export interface KiotVietBankAccountItem extends KiotVietBaseEntity {
  id: number;
  bankName: string;
  accountNumber: string;
  description: string;
}
