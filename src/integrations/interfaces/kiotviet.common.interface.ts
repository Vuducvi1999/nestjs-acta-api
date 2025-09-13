/**
 * Common response wrapper for KiotViet API list endpoints
 */
export interface KiotVietApiListResponse<T> {
  total: number;
  pageSize: number;
  data: T[];
  timestamp: string;
  removeIds?: number[];
}

/**
 * Common base interface for KiotViet entities
 */
export interface KiotVietBaseEntity {
  retailerId: number;
  createdDate: Date;
  modifiedDate?: Date;
}

/**
 * Common interface for location information
 */
export interface KiotVietLocationInfo {
  locationName: string;
  wardName: string;
  address: string;
}

/**
 * Common interface for payment information
 */
export interface KiotVietPaymentBase {
  id: number;
  code: string;
  amount: number;
  method: string;
  status?: number;
  statusValue: string;
  description?: string;
  transDate: Date;
  bankAccount: string;
  accountId?: number;
}

/**
 * Common pagination options for KiotViet API requests
 */
export interface KiotVietPaginationOptions {
  currentItem?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  includeRemoveIds?: boolean;
}

/**
 * Pagination metadata returned by KiotViet API
 */
export interface KiotVietPaginationMeta {
  total: number;
  pageSize: number;
  currentPage?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}
