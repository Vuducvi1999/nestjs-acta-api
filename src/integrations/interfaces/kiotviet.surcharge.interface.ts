import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for surcharge information from KiotViet API
 * Used for endpoint: GET /surchages
 */
export interface KiotVietSurchargeItem extends KiotVietBaseEntity {
  id: number;
  surchargeCode: string;
  surchargeName: string;
  valueRatio?: number;
  value?: number;
}
