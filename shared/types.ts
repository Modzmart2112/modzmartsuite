// CSV Upload Types
export interface CsvRecord {
  sku: string;
  originUrl: string;
  title?: string;
  cost?: string;
  price?: string;
  description?: string;
  [key: string]: string | undefined;
}

export interface PriceDiscrepancy {
  sku: string;
  title: string;
  shopifyPrice: number;
  supplierPrice: number;
  difference: number;
  percentageDifference: number;
  productId: number;
}

export interface ScrapedPriceResult {
  sku: string;
  url: string;
  price: number | null;
  error?: string;
  htmlSample?: string; // For debugging purposes only
  note?: string; // Additional information about the result (e.g., hardcoded price explanation)
}

export interface SalesChannel {
  name: string;
  percentage: number;
  orders: number;
  shipments: number;
}

export interface GeoDistribution {
  country: string;
  customers: number;
  position: {
    left: string;
    top: string;
  };
}

export interface DashboardStats {
  totalOrders: number;
  todayOrders: number;
  averageOrderPrice: number;
  totalShipments: number;
  todayShipments: number;
  totalShippingCost: number;
  totalRevenue: number;
  revenueChange: number;
  totalProfit: number;
  profitChange: number;
  newCustomers: number;
  customersChange: number;
  salesChannels: SalesChannel[];
  geoDistribution: GeoDistribution[];
  productCount: number;
  activeProductCount: number;
  offMarketCount: number;
  newProductsCount: number;
  lastUpdated: string;
}

export interface ShopifyConnectionInfo {
  shopifyApiKey: string;
  shopifyApiSecret: string;
  shopifyStoreUrl: string;
}

export interface TelegramConnectionInfo {
  telegramChatId: string;
}

export interface UploadProgress {
  filename: string;
  total: number;
  processed: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}
