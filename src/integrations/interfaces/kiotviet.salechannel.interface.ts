import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for sale channel information from KiotViet API
 * Used for endpoint: GET /salechannels
 */
export interface KiotVietSaleChannelListItem {
  id: number;
  name: string;
  isActive: boolean;
  img: string;
  isNotDelete: boolean;
}
