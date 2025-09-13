import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for user information from KiotViet API
 * Used for endpoint: GET /users
 */
export interface KiotVietUserItem extends KiotVietBaseEntity {
  id: number;
  userName: string;
  givenName: string;
  address: string;
  mobilePhone: string;
  email: string;
  description: string;
  birthDate: Date;
}
