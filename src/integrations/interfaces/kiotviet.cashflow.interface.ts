
/**
 * Interface for cash flow information from KiotViet API
 * Used for endpoint: GET /cashflows
 */
export interface KiotVietCashFlowItem {
  id: number; //
  code: string; //
  address: string; //
  branchId: number; //
  wardName: string; //
  contactNumber: string; //
  createdBy: number; //
  usedForFinancialReporting: boolean; //
  cashFlowGroupId?: number; //
  method: string; //
  partnerType: string; //
  partnerId?: number; //
  status: number; //
  statusValue: string; //
  transDate: Date; //
  amount: number; //
  partnerName: string; //
  user: string; //
  AccountId?: number; //
  Description: string; //
}
