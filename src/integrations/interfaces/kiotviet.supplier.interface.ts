import {
  KiotVietBaseEntity,
  KiotVietLocationInfo,
} from './kiotviet.common.interface';

/**
 * Interface for supplier information from KiotViet API
 * Used for endpoint: GET /suppliers
 */
export interface KiotVietSupplierItem
  extends KiotVietBaseEntity,
    KiotVietLocationInfo {
  id: number;
  code: string;
  name: string;
  contactNumber: string;
  email: string;
  organization: string;
  comments: string;
  taxCode: string;
  groups: string;
  isActive: boolean;
  branchId: number;
  createdBy: string;
  debt: number;
  totalInvoiced: number;
  totalInvoicedWithoutReturn: number;
}
