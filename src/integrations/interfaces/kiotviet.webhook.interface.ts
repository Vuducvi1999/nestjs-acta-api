import { KiotVietBaseEntity } from './kiotviet.common.interface';

export type WebHookEventType =
  | 'customer.update'
  | 'customer.delete'
  | 'product.update'
  | 'product.delete'
  | 'stock.update'
  | 'order.update'
  | 'invoice.update'
  | 'pricebook.update'
  | 'pricebook.delete'
  | 'pricebookdetail.update'
  | 'pricebookdetail.delete'
  | 'category.update'
  | 'category.delete'
  | 'branch.update'
  | 'branch.delete'
  | string;
/**
 * Interface for webhook information from KiotViet API
 * Used for endpoint: GET /webhooks
 */
export interface KiotVietWebhookItem extends KiotVietBaseEntity {
  id: number;
  type: WebHookEventType;
  url: string;
  isActive: boolean;
  description: string;
}

/**
 * Interface for webhook detail from KiotViet API
 * Used for endpoint: GET /webhooks/{id}
 */
export interface KiotVietWebhookDetailItem extends KiotVietBaseEntity {
  id: number;
  type: string;
  url: string;
  isActive: boolean;
  description: string;
}
