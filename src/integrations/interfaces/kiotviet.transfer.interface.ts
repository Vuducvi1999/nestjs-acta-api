import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for transfer order information from KiotViet API
 * Used for endpoint: GET /transfers/{id}
 */
export interface KiotVietTransferItem extends KiotVietBaseEntity {
  id: number;
  code: string;
  status: number;
  transferredDate: Date;
  receivedDate: Date;
  createdById: number;
  createdByName: string;
  fromBranchId: number;
  fromBranchName: string;
  toBranchId: number;
  toBranchName: string;
  description: string;
  noteBySource: string;
  noteByDestination: string;
  transferDate: Date;
  transferDetails: KiotVietTransferDetailItem[];
}

/**
 * Interface for transfer order detail item
 */
export interface KiotVietTransferDetailItem {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  transferredQuantity: number;
  price: number;
  totalTransfer: number;
  totalReceive: number;
}
