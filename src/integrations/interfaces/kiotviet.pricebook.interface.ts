
/**
 * Interface for price book information from KiotViet API
 * Used for endpoint: GET /pricebooks
 */
export interface KiotVietPriceBookItem {
  id: number;
  name: string;
  isActive: boolean;
  isGlobal: boolean;
  startDate: Date;
  endDate: Date;
  forAllCusGroup: boolean;
  forAllUser: boolean;
  priceBookBranches: any[];
  priceBookCustomerGroups: any[];
  priceBookUsers: any[];
}

/**
 * Interface for price book detail item from KiotViet API
 * Used for endpoint: GET /pricebooks/{id}
 */
export interface KiotVietPriceBookDetailItem {
  productId: number;
  productCode: string;
  price: number;
}
