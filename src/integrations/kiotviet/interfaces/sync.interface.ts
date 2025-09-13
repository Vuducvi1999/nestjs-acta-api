export interface ProductSyncStats {
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  totalProcessed: number;
}

export interface ProductSyncResult {
  success: boolean;
  stats: ProductSyncStats;
  errors: string[];
}
