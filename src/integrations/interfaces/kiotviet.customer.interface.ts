import {
  KiotVietBaseEntity,
  KiotVietLocationInfo,
} from './kiotviet.common.interface';

/**
 * Interface for customer information from KiotViet API
 * Used for endpoint: GET /customers
 */
export interface KiotVietCustomerItem
  extends KiotVietBaseEntity,
    KiotVietLocationInfo {
  id: number;
  code: string;
  name: string;
  gender?: boolean;
  birthDate?: Date;
  contactNumber: string;
  email: string;
  organization: string;
  comments: string;
  taxCode: string;
  debt: number;
  totalInvoiced?: number;
  totalPoint?: number;
  totalRevenue?: number;
  rewardPoint?: number;
  psidFacebook?: number;
}

/**
 * Interface for customer group information from KiotViet API
 * Used for endpoint: GET /customers/group
 */
export interface KiotVietCustomerGroupItem extends KiotVietBaseEntity {
  id: number;
  name: string;
  createdBy: number;
}

/**
 * Interface for customer detail from KiotViet API
 * Used for endpoint: GET /customers/{id}
 */
export interface KiotVietCustomerDetailItem
  extends KiotVietBaseEntity,
    KiotVietLocationInfo {
  id: number;
  code: string;
  name: string;
  gender?: boolean;
  birthDate?: Date;
  contactNumber: string;
  email: string;
  organization: string;
  comments: string;
  taxCode: string;
  debt: number;
  totalInvoiced?: number;
  totalPoint?: number;
  totalRevenue?: number;
  groups: string;
  rewardPoint?: number;
  psidFacebook?: number;
}
