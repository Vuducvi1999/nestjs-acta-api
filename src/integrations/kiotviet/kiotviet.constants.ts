export const API_ENDPOINTS = {
  // Authentication - Xác thực
  TOKEN: '/connect/token', //

  // Branches - Chi nhánh
  BRANCHES: '/branches', // = Warehouse

  // Products - Hàng hóa
  PRODUCTS: {
    LIST: '/products',
    CREATE: '/products',
    DETAIL: (id: string) => `/products/${id}`,
    UPDATE: (id: string) => `/products/${id}`,
    DELETE: (id: string) => `/products/${id}`,
    CREATE_ARRAY: '/listaddproducts',
    UPDATE_ARRAY: '/listupdateproducts',
    ON_HANDS: '/productOnHands',
    ATTRIBUTES: '/attributes/allwithdistinctvalue',
  }, //

  // Customers - Khách hàng
  CUSTOMERS: {
    LIST: '/customers',
    CREATE: '/customers',
    DETAIL: (code: string) => `/customers/code/${code}`,
    UPDATE: (id: string) => `/customers/${id}`,
    DELETE: (id: string) => `/customers/${id}`,
    GROUP: '/customers/group',
    UPDATE_ARRAY: '/listupdatecustomers',
  },

  // Users - Người dùng
  USERS: '/users',

  // Categories - Nhóm hàng
  CATEGORIES: {
    LIST: '/categories',
    CREATE: '/categories',
    DETAIL: (id: string) => `/categories/${id}`,
    UPDATE: (id: string) => `/categories/${id}`,
    DELETE: (id: string) => `/categories/${id}`,
    CREATE_ARRAY: '/listaddcategories',
    UPDATE_ARRAY: '/listupdatecategories',
  },

  // Surcharges - Thu khác
  SURCHARGES: {
    LIST: '/surchages',
    CREATE: '/surchages',
    UPDATE: (id: string) => `/surchages/${id}`,
    ACTIVE: (id: string) => `/surchages/${id}/activesurchage`,
  },

  // Bank Accounts - Tài khoản ngân hàng
  BANK_ACCOUNTS: '/bankaccounts',

  // Webhooks - Webhook
  WEBHOOKS: {
    LIST: '/webhooks',
    CREATE: '/webhooks',
    DELETE: (id: string) => `/webhooks/${id}`,
    DETAIL: (id: string) => `/webhooks/${id}`,
  },

  // Orders - Đặt hàng
  ORDERS: {
    LIST: '/orders',
    SUPPLIERS: '/ordersuppliers',
    DETAIL: (code: string) => `/orders/code/${code}`,
    CREATE: '/orders',
    UPDATE: (id: string) => `/orders/${id}`,
    DELETE: (id: string) => `/orders/${id}`,
  },

  // Invoices - Hóa đơn
  INVOICES: {
    LIST: '/invoices',
    CREATE: '/invoices',
    DETAIL: (id: string) => `/invoices/${id}`,
    DETAIL_BY_CODE: (code: string) => `/invoices/code/${code}`,
    UPDATE: (id: string) => `/invoices/${id}`,
    DELETE: '/invoices',
  },

  // Purchase Orders - Nhập hàng
  PURCHASE_ORDERS: {
    LIST: '/purchaseorders',
    CREATE: '/purchaseorders',
    UPDATE: (id: string) => `/purchaseorders/${id}`,
    DELETE: (id: string) => `/purchaseorders/${id}`,
  },

  // Returns - Trả hàng
  RETURNS: {
    LIST: '/returns',
    DETAIL: (id: string) => `/returns/${id}`,
    DETAIL_BY_CODE: (code: string) => `/returns/code/${code}`,
  },

  // Transfers - Chuyển hàng
  TRANSFERS: {
    LIST: '/transfers',
    CREATE: '/transfers',
    DETAIL: (id: string) => `/transfers/${id}`,
    UPDATE: (id: string) => `/transfers/${id}`,
  },

  // Cashflow - Sổ quỹ
  CASHFLOW: {
    LIST: '/cashflow',
  },

  // Payments - Thanh toán
  PAYMENTS: {
    LIST: '/payments',
    CREATE: '/payments',
  },

  // Pricebooks - Bảng giá
  PRICEBOOKS: {
    LIST: '/pricebooks',
    DETAIL: (id: string) => `/pricebooks/${id}`,
    UPDATE_DETAIL: '/pricebooks/detail',
  },

  // Sale Channels - Kênh bán hàng
  SALE_CHANNELS: {
    LIST: '/salechannel',
  },

  // Order Suppliers - Đặt hàng nhập
  ORDER_SUPPLIERS: {
    LIST: '/ordersuppliers',
    DETAIL: (id: string) => `/ordersuppliers/${id}`,
  },

  // Locations - Danh sách Location
  LOCATIONS: {
    LIST: '/locations',
  },

  // Stores - Cửa hàng
  STORES: {
    SETTINGS: '/settings',
  },

  // Store Settings - Thiết lập cửa hàng
  STORE_SETTINGS: {
    LIST: '/settings',
  },

  // Coupons - Mã giảm giá
  COUPONS: {
    SET_USED: '/coupons/setused',
  },

  // Vouchers - Voucher
  VOUCHERS: {
    LIST: '/voucher',
    CREATE: '/voucher',
    RELEASE: '/voucher/release/give',
    CANCEL: '/voucher/cancel',
  },

  // Voucher Campaigns - Đợt phát hành voucher
  VOUCHER_CAMPAIGNS: {
    LIST: '/vouchercampaign',
  },

  // Trademarks - Thương hiệu
  TRADEMARKS: {
    LIST: '/trademark',
  },

  // Suppliers - Nhà cung cấp
  SUPPLIERS: {
    LIST: '/suppliers',
  },
};
