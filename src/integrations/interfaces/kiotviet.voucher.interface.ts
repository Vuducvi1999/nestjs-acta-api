import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for voucher batch information from KiotViet API
 * Used for endpoint: GET /voucherbatches
 */
export interface KiotVietVoucherCampaignItem extends KiotVietBaseEntity {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  expireTime: number;
  prereqCategoryIds: number[];
  prereqProductIds: number[];
  prereqPrice: number;
  quantity: number;
  price: number;
  useVoucherCombineInvoice: boolean;
  isGlobal: boolean;
  forAllCusGroup: boolean;
  forAllUser: boolean;
  voucherBranchs: KiotVietVoucherBranchItem[];
  voucherUsers: KiotVietVoucherUserItem[];
}

/**
 * Interface for voucher branch item
 */
export interface KiotVietVoucherBranchItem {
  branchId: number;
  branchName: string;
}

/**
 * Interface for voucher user item
 */
export interface KiotVietVoucherUserItem {
  userId: number;
  userName: string;
}

/**
 * Interface for voucher information from KiotViet API
 * Used for endpoint: GET /vouchers
 */
export interface KiotVietVoucherItem {
  id: number;
  code: string;
  voucherCampaignId: number;
  releaseDate: Date;
  expireDate: Date;
  usedDate: Date;
  status: number;
  sellType: number;
  price: number;
  partnerType: string;
  partnerId: number;
  partnerName: string;
}
