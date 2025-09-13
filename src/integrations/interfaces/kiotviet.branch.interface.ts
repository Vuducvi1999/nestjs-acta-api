import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for branch information from KiotViet API
 * Used for endpoint: GET /branches
 */
export interface KiotVietBranchItem extends KiotVietBaseEntity {
  id: number;
  branchName: string;
  branchCode: string;
  contactNumber: string;
  address: string;
  email?: string;
}
