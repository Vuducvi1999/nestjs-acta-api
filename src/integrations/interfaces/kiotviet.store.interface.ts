/**
 * Interface for store settings from KiotViet API
 * Used for endpoint: GET /storesettings
 */
export interface KiotVietStoreSettingsItem {
  ManagerCustomerByBranch: boolean;
  AllowOrderWhenOutStock: boolean;
  AllowSellWhenOrderOutStock: boolean;
  AllowSellWhenOutStock: boolean;
}
