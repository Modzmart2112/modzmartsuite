import { 
  User, InsertUser, Product, InsertProduct, 
  PriceHistory, InsertPriceHistory, CsvUpload, 
  InsertCsvUpload, Notification, InsertNotification,
  Stats, InsertStats, SaleCampaign, InsertSaleCampaign,
  SaleCampaignTarget, InsertSaleCampaignTarget,
  SyncProgress, InsertSyncProgress, ShopifyLog,
  users, products, priceHistories, csvUploads, 
  notifications, stats, saleCampaigns, saleCampaignTargets, syncProgress,
  shopifyLogs
} from "@shared/schema";
import { PriceDiscrepancy } from "@shared/types";
import { db } from "./db";
import { eq, desc, and, asc, isNotNull, sql, inArray } from "drizzle-orm";

// Define the storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  
  // Product operations
  getProducts(limit: number, offset: number): Promise<Product[]>;
  getProductCount(): Promise<number>;
  getActiveProductCount(): Promise<number>;
  getProductsBySku(skus: string[]): Promise<Product[]>;
  getProductById(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductsWithSupplierUrls(): Promise<Product[]>;
  getProductsByVendor(vendor: string, limit?: number, offset?: number): Promise<Product[]>;
  getProductsByProductType(productType: string, limit?: number, offset?: number): Promise<Product[]>;
  getVendors(): Promise<string[]>;
  getProductTypes(): Promise<string[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  searchProducts(query: string, limit: number, offset: number): Promise<Product[]>;
  searchProductCount(query: string): Promise<number>;
  
  // Price history operations
  createPriceHistory(history: InsertPriceHistory): Promise<PriceHistory>;
  getPriceHistoryByProductId(productId: number, limit: number): Promise<PriceHistory[]>;
  
  // CSV upload operations
  createCsvUpload(upload: InsertCsvUpload): Promise<CsvUpload>;
  updateCsvUpload(id: number, upload: Partial<CsvUpload>): Promise<CsvUpload | undefined>;
  getRecentCsvUploads(limit: number): Promise<CsvUpload[]>;
  deleteCsvUpload(id: number): Promise<boolean>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<Notification>): Promise<Notification | undefined>;
  getPendingNotifications(): Promise<Notification[]>;
  
  // Stats operations
  getStats(): Promise<Stats | undefined>;
  updateStats(stats: Partial<Stats>): Promise<Stats | undefined>;
  
  // Price discrepancy operations
  getPriceDiscrepancies(): Promise<PriceDiscrepancy[]>;
  clearPriceDiscrepancies(): Promise<number>; // Returns count of cleared discrepancies
  
  // Sale campaign operations
  getSaleCampaigns(limit: number, offset: number): Promise<SaleCampaign[]>;
  getActiveSaleCampaigns(): Promise<SaleCampaign[]>;
  getSaleCampaignById(id: number): Promise<SaleCampaign | undefined>;
  createSaleCampaign(campaign: InsertSaleCampaign): Promise<SaleCampaign>;
  updateSaleCampaign(id: number, campaign: Partial<SaleCampaign>): Promise<SaleCampaign | undefined>;
  deleteSaleCampaign(id: number): Promise<boolean>;
  addSaleCampaignTarget(target: InsertSaleCampaignTarget): Promise<SaleCampaignTarget>;
  getSaleCampaignTargets(campaignId: number): Promise<SaleCampaignTarget[]>;
  removeSaleCampaignTarget(id: number): Promise<boolean>;
  applySaleCampaign(campaignId: number): Promise<number>; // Returns number of affected products
  revertSaleCampaign(campaignId: number): Promise<number>; // Returns number of reverted products
  
  // Sync progress operations
  initializeShopifySyncProgress(): Promise<SyncProgress>;
  updateShopifySyncProgress(progress: Partial<SyncProgress>): Promise<SyncProgress | undefined>;
  getShopifySyncProgress(): Promise<SyncProgress | null>;
  getRecentShopifyLogs(limit?: number): Promise<ShopifyLog[]>;
  createShopifyLog(message: string, level?: string, metadata?: Record<string, any>): Promise<ShopifyLog>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private priceHistories: Map<number, PriceHistory>;
  private csvUploads: Map<number, CsvUpload>;
  private notifications: Map<number, Notification>;
  private stats: Stats | undefined;
  private saleCampaigns: Map<number, SaleCampaign>;
  private saleCampaignTargets: Map<number, SaleCampaignTarget>;
  private syncProgresses: Map<number, SyncProgress>;
  private shopifyLogs: Map<number, ShopifyLog>;
  
  private userIdCounter: number;
  private productIdCounter: number;
  private priceHistoryIdCounter: number;
  private csvUploadIdCounter: number;
  private notificationIdCounter: number;
  private saleCampaignIdCounter: number;
  private saleCampaignTargetIdCounter: number;
  private syncProgressIdCounter: number;
  private shopifyLogIdCounter: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.priceHistories = new Map();
    this.csvUploads = new Map();
    this.notifications = new Map();
    this.saleCampaigns = new Map();
    this.saleCampaignTargets = new Map();
    this.syncProgresses = new Map();
    this.shopifyLogs = new Map();
    
    this.userIdCounter = 1;
    this.productIdCounter = 1;
    this.priceHistoryIdCounter = 1;
    this.csvUploadIdCounter = 1;
    this.notificationIdCounter = 1;
    this.saleCampaignIdCounter = 1;
    this.saleCampaignTargetIdCounter = 1;
    this.syncProgressIdCounter = 1;
    this.shopifyLogIdCounter = 1;
    
    // Initialize with default stats
    this.stats = {
      id: 1,
      totalOrders: 49238,
      todayOrders: 562,
      averageOrderPrice: 89.23,
      totalShipments: 12238,
      todayShipments: 526,
      totalShippingCost: 23.25,
      totalRevenue: 298560,
      totalProfit: 89390,
      newCustomers: 4239,
      // newProductsCount has been removed from the schema
      salesChannels: {
        channels: [
          { name: "Amazon", percentage: 58.23, orders: 24126, shipments: 15239 },
          { name: "eBay", percentage: 27.56, orders: 13294, shipments: 8392 },
          { name: "Walmart", percentage: 15.92, orders: 7823, shipments: 3259 }
        ]
      },
      geoDistribution: {
        countries: [
          { country: "USA", customers: 3538, position: { left: "23%", top: "30%" } },
          { country: "Europe", customers: 8592, position: { left: "45%", top: "25%" } },
          { country: "Russia", customers: 9223, position: { left: "60%", top: "20%" } },
          { country: "UK", customers: 8926, position: { left: "27%", top: "22%" } },
          { country: "Australia", customers: 5236, position: { left: "75%", top: "68%" } }
        ]
      },
      // Price check metrics
      lastPriceCheck: null,
      totalPriceChecks: 0,
      totalDiscrepanciesFound: 0,
      // Shopify sync metrics
      lastShopifySync: null,
      lastUpdated: new Date()
    };
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      ...userData,
      id,
      telegramChatId: userData.telegramChatId || null,
      shopifyApiKey: userData.shopifyApiKey || null,
      shopifyApiSecret: userData.shopifyApiSecret || null,
      shopifyStoreUrl: userData.shopifyStoreUrl || null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { ...existingUser, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Product operations
  async getProducts(limit: number, offset: number): Promise<Product[]> {
    return Array.from(this.products.values())
      .sort((a, b) => b.id - a.id)
      .slice(offset, offset + limit);
  }

  async getProductCount(): Promise<number> {
    return this.products.size;
  }

  async getActiveProductCount(): Promise<number> {
    return Array.from(this.products.values()).filter(p => p.status === 'active').length;
  }

  async getProductsBySku(skus: string[]): Promise<Product[]> {
    return Array.from(this.products.values()).filter(product => 
      skus.includes(product.sku)
    );
  }

  async getProductById(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(
      (product) => product.sku === sku
    );
  }
  
  async getProductsWithSupplierUrls(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(product => product.supplierUrl !== null && product.supplierUrl !== '');
  }
  
  async getProductsByVendor(vendor: string, limit?: number, offset?: number): Promise<Product[]> {
    const filteredProducts = Array.from(this.products.values())
      .filter(product => product.vendor === vendor)
      .sort((a, b) => a.title.localeCompare(b.title));
    
    if (limit !== undefined && offset !== undefined) {
      return filteredProducts.slice(offset, offset + limit);
    }
    return filteredProducts;
  }
  
  async getProductsByProductType(productType: string, limit?: number, offset?: number): Promise<Product[]> {
    const filteredProducts = Array.from(this.products.values())
      .filter(product => product.productType === productType)
      .sort((a, b) => a.title.localeCompare(b.title));
    
    if (limit !== undefined && offset !== undefined) {
      return filteredProducts.slice(offset, offset + limit);
    }
    return filteredProducts;
  }
  
  async getVendors(): Promise<string[]> {
    const vendors = new Set<string>();
    for (const product of this.products.values()) {
      if (product.vendor) {
        vendors.add(product.vendor);
      }
    }
    return Array.from(vendors).sort();
  }
  
  async getProductTypes(): Promise<string[]> {
    const productTypes = new Set<string>();
    for (const product of this.products.values()) {
      if (product.productType) {
        productTypes.add(product.productType);
      }
    }
    return Array.from(productTypes).sort();
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const now = new Date();
    const product: Product = { 
      ...productData, 
      id,
      status: productData.status || null,
      description: productData.description || null,
      supplierUrl: productData.supplierUrl || null,
      supplierPrice: productData.supplierPrice || null,
      lastScraped: productData.lastScraped || null,
      images: productData.images || [],
      vendor: productData.vendor || null,
      productType: productData.productType || null,
      createdAt: now,
      updatedAt: now
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) return undefined;
    
    const updatedProduct = { 
      ...existingProduct, 
      ...productData,
      updatedAt: new Date()
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  // Search operations
  async searchProducts(query: string, limit: number, offset: number): Promise<Product[]> {
    const normalizedQuery = query.trim().toLowerCase();
    return Array.from(this.products.values())
      .filter(product => 
        product.sku.toLowerCase().includes(normalizedQuery) || 
        (product.title && product.title.toLowerCase().includes(normalizedQuery))
      )
      .sort((a, b) => b.id - a.id)
      .slice(offset, offset + limit);
  }
  
  async searchProductCount(query: string): Promise<number> {
    const normalizedQuery = query.trim().toLowerCase();
    return Array.from(this.products.values())
      .filter(product => 
        product.sku.toLowerCase().includes(normalizedQuery) || 
        (product.title && product.title.toLowerCase().includes(normalizedQuery))
      ).length;
  }

  // Price history operations
  async createPriceHistory(historyData: InsertPriceHistory): Promise<PriceHistory> {
    const id = this.priceHistoryIdCounter++;
    const history: PriceHistory = { 
      ...historyData, 
      id,
      supplierPrice: historyData.supplierPrice || null,
      createdAt: new Date()
    };
    this.priceHistories.set(id, history);
    return history;
  }

  async getPriceHistoryByProductId(productId: number, limit: number): Promise<PriceHistory[]> {
    return Array.from(this.priceHistories.values())
      .filter(history => history.productId === productId)
      .sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  // CSV upload operations
  async createCsvUpload(uploadData: InsertCsvUpload): Promise<CsvUpload> {
    const id = this.csvUploadIdCounter++;
    const upload: CsvUpload = { 
      ...uploadData, 
      id,
      createdAt: new Date()
    };
    this.csvUploads.set(id, upload);
    return upload;
  }

  async updateCsvUpload(id: number, uploadData: Partial<CsvUpload>): Promise<CsvUpload | undefined> {
    const existingUpload = this.csvUploads.get(id);
    if (!existingUpload) return undefined;
    
    const updatedUpload = { ...existingUpload, ...uploadData };
    this.csvUploads.set(id, updatedUpload);
    return updatedUpload;
  }

  async getRecentCsvUploads(limit: number): Promise<CsvUpload[]> {
    const sorted = Array.from(this.csvUploads.values())
      .sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      });
    
    // If limit is -1, return all uploads with no limit
    if (limit === -1) {
      console.log(`Returning all ${sorted.length} CSV uploads without limit`);
      return sorted;
    }
    
    // Otherwise apply the limit
    return sorted.slice(0, limit);
  }
  
  async deleteCsvUpload(id: number): Promise<boolean> {
    return this.csvUploads.delete(id);
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const notification: Notification = { 
      ...notificationData, 
      id,
      status: notificationData.status || null,
      createdAt: new Date(),
      sentAt: null
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const existingNotification = this.notifications.get(id);
    if (!existingNotification) return undefined;
    
    const updatedNotification = { ...existingNotification, ...notificationData };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async getPendingNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.status === 'pending')
      .sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeA - timeB;
      });
  }

  // Stats operations
  async getStats(): Promise<Stats | undefined> {
    return this.stats;
  }

  async updateStats(statsData: Partial<Stats>): Promise<Stats | undefined> {
    if (!this.stats) return undefined;
    
    this.stats = { 
      ...this.stats, 
      ...statsData,
      lastUpdated: new Date()
    };
    return this.stats;
  }

  // Price discrepancy operations
  async getPriceDiscrepancies(): Promise<PriceDiscrepancy[]> {
    const discrepancies: PriceDiscrepancy[] = [];
    
    for (const product of this.products.values()) {
      if (product.hasPriceDiscrepancy && product.supplierPrice) {
        const difference = product.supplierPrice - product.shopifyPrice;
        const percentageDifference = (difference / product.shopifyPrice) * 100;
        
        discrepancies.push({
          sku: product.sku,
          title: product.title,
          shopifyPrice: product.shopifyPrice,
          supplierPrice: product.supplierPrice,
          difference,
          percentageDifference,
          productId: product.id
        });
      }
    }
    
    return discrepancies.sort((a, b) => Math.abs(b.percentageDifference) - Math.abs(a.percentageDifference));
  }
  
  async clearPriceDiscrepancies(): Promise<number> {
    let clearedCount = 0;
    
    for (const product of this.products.values()) {
      if (product.hasPriceDiscrepancy) {
        product.hasPriceDiscrepancy = false;
        // Keep supplierUrl and supplierPrice so the scheduler can still check these URLs
        product.updatedAt = new Date();
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  // Sale campaign operations
  async getSaleCampaigns(limit: number, offset: number): Promise<SaleCampaign[]> {
    return Array.from(this.saleCampaigns.values())
      .sort((a, b) => b.id - a.id)
      .slice(offset, offset + limit);
  }

  async getActiveSaleCampaigns(): Promise<SaleCampaign[]> {
    const now = new Date();
    return Array.from(this.saleCampaigns.values())
      .filter(campaign => {
        if (!campaign.startDate || !campaign.endDate) return false;
        
        const startDate = new Date(campaign.startDate);
        const endDate = new Date(campaign.endDate);
        
        return startDate <= now && endDate >= now && campaign.status === 'active';
      })
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
  }

  async getSaleCampaignById(id: number): Promise<SaleCampaign | undefined> {
    return this.saleCampaigns.get(id);
  }

  async createSaleCampaign(campaignData: InsertSaleCampaign): Promise<SaleCampaign> {
    const id = this.saleCampaignIdCounter++;
    const now = new Date();
    
    const campaign: SaleCampaign = {
      ...campaignData,
      id,
      status: campaignData.status || 'draft',
      createdAt: now,
      updatedAt: now
    };
    
    this.saleCampaigns.set(id, campaign);
    return campaign;
  }

  async updateSaleCampaign(id: number, campaignData: Partial<SaleCampaign>): Promise<SaleCampaign | undefined> {
    const existingCampaign = this.saleCampaigns.get(id);
    if (!existingCampaign) return undefined;
    
    const updatedCampaign = {
      ...existingCampaign,
      ...campaignData,
      updatedAt: new Date()
    };
    
    this.saleCampaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  async deleteSaleCampaign(id: number): Promise<boolean> {
    // First delete all associated targets
    const campaignTargets = Array.from(this.saleCampaignTargets.values())
      .filter(target => target.campaignId === id);
    
    for (const target of campaignTargets) {
      this.saleCampaignTargets.delete(target.id);
    }
    
    // Then delete the campaign itself
    return this.saleCampaigns.delete(id);
  }

  async addSaleCampaignTarget(targetData: InsertSaleCampaignTarget): Promise<SaleCampaignTarget> {
    const id = this.saleCampaignTargetIdCounter++;
    const now = new Date();
    
    const target: SaleCampaignTarget = {
      ...targetData,
      id,
      createdAt: now
    };
    
    this.saleCampaignTargets.set(id, target);
    return target;
  }

  async getSaleCampaignTargets(campaignId: number): Promise<SaleCampaignTarget[]> {
    return Array.from(this.saleCampaignTargets.values())
      .filter(target => target.campaignId === campaignId);
  }

  async removeSaleCampaignTarget(id: number): Promise<boolean> {
    return this.saleCampaignTargets.delete(id);
  }

  async applySaleCampaign(campaignId: number): Promise<number> {
    const campaign = await this.getSaleCampaignById(campaignId);
    if (!campaign) return 0;
    
    const targets = await this.getSaleCampaignTargets(campaignId);
    if (targets.length === 0) return 0;
    
    let affectedProductCount = 0;
    const now = new Date();
    
    // Process and apply the discounts to products
    for (const target of targets) {
      let products: Product[] = [];
      
      if (target.targetType === 'sku') {
        // Single product by SKU
        const product = await this.getProductBySku(target.targetValue);
        if (product) products = [product];
      } else if (target.targetType === 'vendor') {
        // All products by vendor
        products = Array.from(this.products.values())
          .filter(p => p.vendor === target.targetValue);
      } else if (target.targetType === 'product_type') {
        // All products by product type
        products = Array.from(this.products.values())
          .filter(p => p.productType === target.targetValue);
      } else if (target.targetType === 'tag') {
        // Products with a specific tag
        // For in-memory storage, this would need to be implemented if tags are added
        continue;
      }
      
      // Apply the discount to each product
      for (const product of products) {
        // Create a price history record first
        await this.createPriceHistory({
          productId: product.id,
          shopifyPrice: product.shopifyPrice,
          supplierPrice: product.supplierPrice,
          notes: `Sale campaign #${campaignId} applied: ${campaign.name}`
        });
        
        let newPrice = product.shopifyPrice;
        
        if (campaign.discountType === 'percentage') {
          // Apply percentage discount
          const discountAmount = product.shopifyPrice * (campaign.discountValue / 100);
          newPrice = product.shopifyPrice - discountAmount;
        } else if (campaign.discountType === 'fixed_amount') {
          // Apply fixed amount discount
          newPrice = product.shopifyPrice - campaign.discountValue;
        } else if (campaign.discountType === 'new_price') {
          // Set specific price
          newPrice = campaign.discountValue;
        }
        
        // Ensure price doesn't go below zero
        newPrice = Math.max(newPrice, 0);
        
        // Update the product with the new price
        await this.updateProduct(product.id, {
          shopifyPrice: newPrice,
          updatedAt: now,
          onSale: true,
          originalPrice: product.shopifyPrice,
          saleEndDate: campaign.endDate,
          saleId: campaign.id
        });
        
        affectedProductCount++;
      }
    }
    
    // Mark the campaign as active
    await this.updateSaleCampaign(campaignId, { status: 'active', appliedAt: now });
    
    return affectedProductCount;
  }

  async revertSaleCampaign(campaignId: number): Promise<number> {
    // Find all products that are on sale with this campaign ID
    const productsOnSale = Array.from(this.products.values())
      .filter(p => p.onSale && p.saleId === campaignId);
    
    let revertedCount = 0;
    const now = new Date();
    
    for (const product of productsOnSale) {
      // Only revert if the product has an original price
      if (product.originalPrice) {
        // Create a price history record for the reversion
        await this.createPriceHistory({
          productId: product.id,
          shopifyPrice: product.shopifyPrice,
          supplierPrice: product.supplierPrice,
          notes: `Sale campaign #${campaignId} reverted`
        });
        
        // Restore the original price
        await this.updateProduct(product.id, {
          shopifyPrice: product.originalPrice,
          updatedAt: now,
          onSale: false,
          originalPrice: null,
          saleEndDate: null,
          saleId: null
        });
        
        revertedCount++;
      }
    }
    
    // Mark the campaign as completed
    await this.updateSaleCampaign(campaignId, { status: 'completed', completedAt: now });
    
    return revertedCount;
  }
  
  // Sync progress operations
  async initializeShopifySyncProgress(): Promise<SyncProgress> {
    // Delete any existing "shopify-sync" progress records that are pending or in-progress
    const existingProgresses = Array.from(this.syncProgresses.values())
      .filter(p => p.type === "shopify-sync" && (p.status === "pending" || p.status === "in-progress"));
    
    for (const progress of existingProgresses) {
      this.syncProgresses.delete(progress.id);
    }
    
    // Create a new progress record
    const id = this.syncProgressIdCounter++;
    const progress: SyncProgress = {
      id,
      type: "shopify-sync",
      status: "pending",
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      message: "Shopify sync initialized and ready to start",
      details: {},
      startedAt: new Date(),
      completedAt: null
    };
    
    this.syncProgresses.set(id, progress);
    return progress;
  }
  
  async updateShopifySyncProgress(progressData: Partial<SyncProgress>): Promise<SyncProgress | undefined> {
    // Get the most recent shopify sync progress
    const sortedProgresses = Array.from(this.syncProgresses.values())
      .filter(p => p.type === "shopify-sync")
      .sort((a, b) => b.id - a.id);
    
    const currentProgress = sortedProgresses.length > 0 ? sortedProgresses[0] : undefined;
    if (!currentProgress) return undefined;
    
    // Calculate percentage complete
    const percentage = progressData.totalItems && progressData.processedItems
      ? Math.round((progressData.processedItems / progressData.totalItems) * 100)
      : undefined;
    
    // If status is being updated to "complete", set the completedAt date
    const completedAt = progressData.status === "complete" ? new Date() : currentProgress.completedAt;
    
    // Update the progress
    const updatedProgress: SyncProgress = {
      ...currentProgress,
      ...progressData,
      completedAt,
      details: {
        ...currentProgress.details,
        percentage,
        ...(progressData.details || {})
      }
    };
    
    this.syncProgresses.set(currentProgress.id, updatedProgress);
    return updatedProgress;
  }
  
  async getShopifySyncProgress(): Promise<SyncProgress | null> {
    // Get the most recent shopify sync progress
    const sortedProgresses = Array.from(this.syncProgresses.values())
      .filter(p => p.type === "shopify-sync")
      .sort((a, b) => b.id - a.id);
    
    return sortedProgresses.length > 0 ? sortedProgresses[0] : null;
  }
  
  /**
   * Get recent Shopify API logs for analyzing sync progress
   * @param limit The maximum number of logs to retrieve
   */
  async getRecentShopifyLogs(limit: number = 20): Promise<ShopifyLog[]> {
    // Get recent shopify logs, ordered by creation time descending (newest first)
    return Array.from(this.shopifyLogs.values())
      .sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }
  
  async createShopifyLog(message: string, level: string = 'info', metadata: Record<string, any> = {}): Promise<ShopifyLog> {
    const id = this.shopifyLogIdCounter++;
    const log: ShopifyLog = {
      id,
      message,
      level,
      createdAt: new Date(),
      metadata
    };
    this.shopifyLogs.set(id, log);
    return log;
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Product operations
  async getProducts(limit: number, offset: number): Promise<Product[]> {
    try {
      console.log(`Getting products with limit: ${limit}, offset: ${offset}`);
      
      // Use direct SQL instead of ORM
      // Fixed parameter binding by providing integer values directly in SQL
      // This avoids the parameter binding issue
      const query = `
        SELECT * FROM products
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      // No parameters needed since values are directly in the query
      const result = await db.execute(query);
      
      // Convert snake_case column names to camelCase for consistency
      const mappedProducts = result.rows.map(product => {
        return {
          ...product,
          // Manually map the snake_case fields to camelCase
          costPrice: product.cost_price,
          shopifyId: product.shopify_id,
          shopifyPrice: product.shopify_price,
          supplierUrl: product.supplier_url,
          supplierPrice: product.supplier_price,
          lastScraped: product.last_scraped,
          lastChecked: product.last_checked,
          hasPriceDiscrepancy: product.has_price_discrepancy,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          productType: product.product_type,
          onSale: product.on_sale,
          originalPrice: product.original_price,
          saleEndDate: product.sale_end_date,
          saleId: product.sale_id
        };
      });
      
      // Check if we got results
      if (mappedProducts.length === 0) {
        console.log('No products found');
      } else {
        // Log a sample product to debug
        const sampleProduct = mappedProducts[0];
        console.log('Product sample cost price check: ');
        console.log(`\tFirst product SKU: ${sampleProduct.sku}`);
        console.log(`\tCost price: ${sampleProduct.costPrice}`);
        console.log(`\tCost price type: ${typeof sampleProduct.costPrice}`);
        console.log(`\tAll properties: ${Object.keys(sampleProduct).join(', ')}`);
      }
      
      console.log(`Found ${mappedProducts.length} products, total: ${result.rowCount || 'unknown'}`);
      return mappedProducts as Product[];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  async getProductCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(products);
    return Number(result[0].count);
  }
  
  /**
   * Get the total count of products regardless of status
   * Simple wrapper around getProductCount for cleaner API calls
   */
  async getTotalProductCount(): Promise<number> {
    return this.getProductCount();
  }

  async getActiveProductCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` })
      .from(products)
      .where(eq(products.status, 'active'));
    return Number(result[0].count);
  }

  async getProductsBySku(skus: string[]): Promise<Product[]> {
    // Using case-insensitive matching for multiple SKUs
    if (skus.length === 0) return [];
    
    try {
      console.log(`Fetching products by SKUs: ${skus.join(', ')}`);
      
      // Need to use a SQL expression directly since we need to normalize the SKUs case-insensitively
      const normalizedSkus = skus.map(sku => sku.trim().toUpperCase());
      
      // Generate placeholders and parameter values for the SQL query
      const placeholders = normalizedSkus.map((_, i) => `$${i + 1}`).join(', ');
      const query = `
        SELECT * FROM products 
        WHERE UPPER(sku) IN (${placeholders})
      `;
      
      // Execute with normalized SKUs as parameters
      const result = await db.execute(query, normalizedSkus);
      
      return result.rows as Product[];
    } catch (error) {
      console.error('Error fetching products by SKU:', error);
      return [];
    }
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const result = await db.select({
      id: products.id,
      sku: products.sku,
      title: products.title,
      description: products.description,
      shopifyId: products.shopifyId,
      shopifyPrice: products.shopifyPrice,
      costPrice: products.costPrice,  // Explicitly include costPrice
      supplierUrl: products.supplierUrl,
      supplierPrice: products.supplierPrice,
      lastScraped: products.lastScraped,
      lastChecked: products.lastChecked,
      hasPriceDiscrepancy: products.hasPriceDiscrepancy,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      status: products.status,
      images: products.images,
      vendor: products.vendor,
      productType: products.productType,
      onSale: products.onSale,
      originalPrice: products.originalPrice,
      saleEndDate: products.saleEndDate,
      saleId: products.saleId
    })
    .from(products)
    .where(eq(products.id, id));
    
    return result[0];
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    // Normalize the SKU by trimming and converting to uppercase for consistent matching
    const normalizedSku = sku.trim().toUpperCase();
    
    // Define the fields we want to select explicitly
    const selectFields = {
      id: products.id,
      sku: products.sku,
      title: products.title,
      description: products.description,
      shopifyId: products.shopifyId,
      shopifyPrice: products.shopifyPrice,
      costPrice: products.costPrice,  // Explicitly include costPrice
      supplierUrl: products.supplierUrl,
      supplierPrice: products.supplierPrice,
      lastScraped: products.lastScraped,
      lastChecked: products.lastChecked,
      hasPriceDiscrepancy: products.hasPriceDiscrepancy,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      status: products.status,
      images: products.images,
      vendor: products.vendor,
      productType: products.productType,
      onSale: products.onSale,
      originalPrice: products.originalPrice,
      saleEndDate: products.saleEndDate,
      saleId: products.saleId
    };
    
    // First try exact matching
    let result = await db.select(selectFields)
      .from(products)
      .where(sql`UPPER(${products.sku}) = ${normalizedSku}`);
    
    if (result.length > 0) {
      return result[0];
    }
    
    // If no exact match, try a more fuzzy match (removing any spaces)
    const noSpaceSku = normalizedSku.replace(/\s+/g, '');
    result = await db.select(selectFields)
      .from(products)
      .where(sql`REPLACE(UPPER(${products.sku}), ' ', '') = ${noSpaceSku}`);
    
    if (result.length > 0) {
      console.log(`Found product by fuzzy SKU match: "${sku}" matched with "${result[0].sku}"`);
    }
    
    return result[0];
  }
  
  async getProductsWithSupplierUrls(): Promise<Product[]> {
    return await db.select({
      id: products.id,
      sku: products.sku,
      title: products.title,
      description: products.description,
      shopifyId: products.shopifyId,
      shopifyPrice: products.shopifyPrice,
      costPrice: products.costPrice,  // Explicitly include costPrice
      supplierUrl: products.supplierUrl,
      supplierPrice: products.supplierPrice,
      lastScraped: products.lastScraped,
      lastChecked: products.lastChecked,
      hasPriceDiscrepancy: products.hasPriceDiscrepancy,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      status: products.status,
      images: products.images,
      vendor: products.vendor,
      productType: products.productType,
      onSale: products.onSale,
      originalPrice: products.originalPrice,
      saleEndDate: products.saleEndDate,
      saleId: products.saleId
    })
      .from(products)
      .where(
        and(
          isNotNull(products.supplierUrl),
          sql`${products.supplierUrl} != ''`
        )
      )
      .orderBy(asc(products.id));
  }
  
  async getProductsByVendor(vendor: string, limit?: number, offset?: number): Promise<Product[]> {
    try {
      console.log(`Getting products for vendor: ${vendor}, limit: ${limit}, offset: ${offset}`);
      
      // Build query with direct value interpolation instead of parameters
      let queryStr = `SELECT * FROM products WHERE vendor = '${vendor.replace(/'/g, "''")}' ORDER BY title ASC`;
      
      // Add pagination if needed
      if (limit !== undefined && offset !== undefined) {
        queryStr += ` LIMIT ${limit} OFFSET ${offset}`;
      }
      
      // Execute raw query without parameters
      const result = await db.execute(queryStr);
      
      // Convert snake_case column names to camelCase for consistency
      const mappedProducts = result.rows.map(product => {
        return {
          ...product,
          // Manually map the snake_case fields to camelCase
          costPrice: product.cost_price,
          shopifyId: product.shopify_id,
          shopifyPrice: product.shopify_price,
          supplierUrl: product.supplier_url,
          supplierPrice: product.supplier_price,
          lastScraped: product.last_scraped,
          lastChecked: product.last_checked,
          hasPriceDiscrepancy: product.has_price_discrepancy,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          productType: product.product_type,
          onSale: product.on_sale,
          originalPrice: product.original_price,
          saleEndDate: product.sale_end_date,
          saleId: product.sale_id
        };
      });
      
      return mappedProducts as Product[];
    } catch (error) {
      console.error(`Error fetching products for vendor ${vendor}:`, error);
      return [];
    }
  }
  
  async getProductsByProductType(productType: string, limit?: number, offset?: number): Promise<Product[]> {
    try {
      console.log(`Getting products for product type: ${productType}, limit: ${limit}, offset: ${offset}`);
      
      // Build query with direct value interpolation instead of parameters
      let queryStr = `SELECT * FROM products WHERE product_type = '${productType.replace(/'/g, "''")}' ORDER BY title ASC`;
      
      // Add pagination if needed
      if (limit !== undefined && offset !== undefined) {
        queryStr += ` LIMIT ${limit} OFFSET ${offset}`;
      }
      
      // Execute raw query without parameters
      const result = await db.execute(queryStr);
      
      // Convert snake_case column names to camelCase for consistency
      const mappedProducts = result.rows.map(product => {
        return {
          ...product,
          // Manually map the snake_case fields to camelCase
          costPrice: product.cost_price,
          shopifyId: product.shopify_id,
          shopifyPrice: product.shopify_price,
          supplierUrl: product.supplier_url,
          supplierPrice: product.supplier_price,
          lastScraped: product.last_scraped,
          lastChecked: product.last_checked,
          hasPriceDiscrepancy: product.has_price_discrepancy,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          productType: product.product_type,
          onSale: product.on_sale,
          originalPrice: product.original_price,
          saleEndDate: product.sale_end_date,
          saleId: product.sale_id
        };
      });
      
      return mappedProducts as Product[];
    } catch (error) {
      console.error(`Error fetching products for product type ${productType}:`, error);
      return [];
    }
  }
  
  async getVendors(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT vendor 
        FROM products 
        WHERE vendor IS NOT NULL AND vendor != '' 
        ORDER BY vendor ASC
      `;
      
      const result = await db.execute(query);
      // Map the result rows to just return the vendor strings
      return result.rows.map(row => row.vendor).filter(Boolean) as string[];
    } catch (error) {
      console.error('Error fetching vendors:', error);
      return [];
    }
  }
  
  async getProductTypes(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT product_type 
        FROM products 
        WHERE product_type IS NOT NULL AND product_type != '' 
        ORDER BY product_type ASC
      `;
      
      const result = await db.execute(query);
      // Map the result rows to just return the product_type strings
      return result.rows.map(row => row.product_type).filter(Boolean) as string[];
    } catch (error) {
      console.error('Error fetching product types:', error);
      return [];
    }
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    console.log(`Creating product ${product.sku} with cost price: ${product.costPrice} (${typeof product.costPrice})`);
    
    // Special handling for costPrice
    const productData: Record<string, any> = {
      sku: product.sku,
      title: product.title,
      description: product.description,
      shopifyId: product.shopifyId,
      shopifyPrice: product.shopifyPrice,
      images: product.images,
      status: product.status || 'active',
      vendor: product.vendor,
      productType: product.productType,
      supplierUrl: product.supplierUrl,
      supplierPrice: product.supplierPrice,
      onSale: product.onSale,
      originalPrice: product.originalPrice,
      saleEndDate: product.saleEndDate,
      saleId: product.saleId,
      // other fields
    };
    
    // Special handling for costPrice - use the snake_case for the DB column
    if (product.costPrice !== undefined && product.costPrice !== null) {
      // Make sure it's a number
      if (typeof product.costPrice === 'string') {
        productData.cost_price = parseFloat(product.costPrice);
      } else {
        productData.cost_price = product.costPrice;
      }
      
      console.log(`Final costPrice value for new product: ${productData.cost_price} (${typeof productData.cost_price})`);
    }
    
    const [createdProduct] = await db.insert(products).values(productData).returning();
    return createdProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    try {
      console.log(`Updating product ${id} with data:`, productData);
      
      // Build update data - only include defined fields
      const updateData: Record<string, any> = {};
      
      // Always set updatedAt
      updateData.updatedAt = new Date();
      
      // Map fields to their camelCase properties
      if (productData.title !== undefined) updateData.title = productData.title;
      if (productData.description !== undefined) updateData.description = productData.description;
      if (productData.shopifyPrice !== undefined) updateData.shopifyPrice = productData.shopifyPrice;
      if (productData.supplierPrice !== undefined) updateData.supplierPrice = productData.supplierPrice;
      if (productData.hasPriceDiscrepancy !== undefined) updateData.hasPriceDiscrepancy = productData.hasPriceDiscrepancy;
      if (productData.lastChecked !== undefined) updateData.lastChecked = productData.lastChecked;
      if (productData.supplierUrl !== undefined) updateData.supplierUrl = productData.supplierUrl;
      if (productData.lastScraped !== undefined) updateData.lastScraped = productData.lastScraped;
      if (productData.status !== undefined) updateData.status = productData.status;
      if (productData.images !== undefined) updateData.images = productData.images;
      if (productData.vendor !== undefined) updateData.vendor = productData.vendor;
      if (productData.productType !== undefined) updateData.productType = productData.productType;
      if (productData.onSale !== undefined) updateData.onSale = productData.onSale;
      if (productData.originalPrice !== undefined) updateData.originalPrice = productData.originalPrice;
      if (productData.saleEndDate !== undefined) updateData.saleEndDate = productData.saleEndDate;
      if (productData.saleId !== undefined) updateData.saleId = productData.saleId;
      
      // Special handling for costPrice - key issue fixed here
      if (productData.costPrice !== undefined && productData.costPrice !== null) {
        console.log(`Processing costPrice in updateProduct: ${productData.costPrice} (${typeof productData.costPrice})`);
        
        // Make sure it's a number
        if (typeof productData.costPrice === 'string') {
          updateData.cost_price = parseFloat(productData.costPrice);
        } else {
          updateData.cost_price = productData.costPrice;
        }
        
        // Debug the final value
        console.log(`Final costPrice value being set: ${updateData.cost_price} (${typeof updateData.cost_price})`);
      }
      
      // Use Drizzle ORM for the update
      const result = await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, id))
        .returning();
      
      if (result.length === 0) {
        console.error(`Product update failed, no rows returned for id ${id}`);
        return undefined;
      }
      
      // Return updated product
      console.log(`Successfully updated product ${id}`);
      return result[0];
    } catch (error) {
      console.error(`Error updating product ${id}:`, error);
      return undefined;
    }
  }
  
  // Search operations
  async searchProducts(query: string, limit: number, offset: number): Promise<Product[]> {
    try {
      const searchTerm = `%${query.trim().replace(/'/g, "''")}%`;
      
      // Direct SQL approach with inline values to avoid parameter binding issues
      const sqlQuery = `
        SELECT * FROM products
        WHERE LOWER(sku) LIKE LOWER('${searchTerm}') OR LOWER(title) LIKE LOWER('${searchTerm}')
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const result = await db.execute(sqlQuery);
      
      // Convert snake_case column names to camelCase for consistency
      const mappedProducts = result.rows.map(product => {
        return {
          ...product,
          // Manually map the snake_case fields to camelCase
          costPrice: product.cost_price,
          shopifyId: product.shopify_id,
          shopifyPrice: product.shopify_price,
          supplierUrl: product.supplier_url,
          supplierPrice: product.supplier_price,
          lastScraped: product.last_scraped,
          lastChecked: product.last_checked,
          hasPriceDiscrepancy: product.has_price_discrepancy,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          productType: product.product_type,
          onSale: product.on_sale,
          originalPrice: product.original_price,
          saleEndDate: product.sale_end_date,
          saleId: product.sale_id
        };
      });
      
      return mappedProducts as Product[];
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }
  
  async searchProductCount(query: string): Promise<number> {
    try {
      const searchTerm = `%${query.trim().replace(/'/g, "''")}%`;
      
      // Direct SQL count query with inline value to avoid parameter binding issues
      const sqlQuery = `
        SELECT COUNT(*) as count FROM products
        WHERE LOWER(sku) LIKE LOWER('${searchTerm}') OR LOWER(title) LIKE LOWER('${searchTerm}')
      `;
      
      const result = await db.execute(sqlQuery);
      return Number(result.rows[0].count);
    } catch (error) {
      console.error('Error counting search results:', error);
      return 0;
    }
  }

  // Price history operations
  async createPriceHistory(history: InsertPriceHistory): Promise<PriceHistory> {
    const [createdHistory] = await db.insert(priceHistories).values(history).returning();
    return createdHistory;
  }

  async getPriceHistoryByProductId(productId: number, limit: number): Promise<PriceHistory[]> {
    return await db.select()
      .from(priceHistories)
      .where(eq(priceHistories.productId, productId))
      .orderBy(desc(priceHistories.createdAt))
      .limit(limit);
  }

  // CSV upload operations
  async createCsvUpload(upload: InsertCsvUpload): Promise<CsvUpload> {
    const [createdUpload] = await db.insert(csvUploads).values(upload).returning();
    return createdUpload;
  }

  async updateCsvUpload(id: number, uploadData: Partial<CsvUpload>): Promise<CsvUpload | undefined> {
    const [updatedUpload] = await db.update(csvUploads)
      .set(uploadData)
      .where(eq(csvUploads.id, id))
      .returning();
    return updatedUpload;
  }

  async getRecentCsvUploads(limit: number): Promise<CsvUpload[]> {
    // If limit is -1, don't apply a limit (get all uploads)
    if (limit === -1) {
      console.log('DatabaseStorage: Getting all CSV uploads without limit');
      return await db.select()
        .from(csvUploads)
        .orderBy(desc(csvUploads.createdAt));
    }
    
    // Otherwise, apply the specified limit
    return await db.select()
      .from(csvUploads)
      .orderBy(desc(csvUploads.createdAt))
      .limit(limit);
  }
  
  async deleteCsvUpload(id: number): Promise<boolean> {
    try {
      const result = await db.delete(csvUploads)
        .where(eq(csvUploads.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting CSV upload ${id}:`, error);
      return false;
    }
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [createdNotification] = await db.insert(notifications).values(notification).returning();
    return createdNotification;
  }

  async updateNotification(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const [updatedNotification] = await db.update(notifications)
      .set(notificationData)
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async getPendingNotifications(): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.status, 'pending'))
      .orderBy(asc(notifications.createdAt));
  }

  // Stats operations
  async getStats(): Promise<Stats | undefined> {
    const result = await db.select().from(stats).limit(1);
    return result[0];
  }

  async updateStats(statsData: Partial<Stats>): Promise<Stats | undefined> {
    // First check if stats exist
    const existingStats = await this.getStats();
    
    if (existingStats) {
      // Update existing stats
      const now = new Date();
      const [updatedStats] = await db.update(stats)
        .set({ ...statsData, lastUpdated: now })
        .where(eq(stats.id, existingStats.id))
        .returning();
      return updatedStats;
    } else {
      // Create new stats if they don't exist
      const now = new Date();
      const defaultStats = {
        totalOrders: 49238,
        todayOrders: 562,
        averageOrderPrice: 89.23,
        totalShipments: 12238,
        todayShipments: 526,
        totalShippingCost: 23.25,
        totalRevenue: 298560,
        totalProfit: 89390,
        newCustomers: 4239,
        salesChannels: {
          channels: [
            { name: "Amazon", percentage: 58.23, orders: 24126, shipments: 15239 },
            { name: "eBay", percentage: 27.56, orders: 13294, shipments: 8392 },
            { name: "Walmart", percentage: 15.92, orders: 7823, shipments: 3259 }
          ]
        },
        geoDistribution: {
          countries: [
            { country: "USA", customers: 3538, position: { left: "23%", top: "30%" } },
            { country: "Europe", customers: 8592, position: { left: "45%", top: "25%" } },
            { country: "Russia", customers: 9223, position: { left: "60%", top: "20%" } },
            { country: "UK", customers: 8926, position: { left: "27%", top: "22%" } },
            { country: "Australia", customers: 5236, position: { left: "75%", top: "68%" } }
          ]
        },
        lastUpdated: now,
        ...statsData
      };
      
      const [createdStats] = await db.insert(stats).values(defaultStats).returning();
      return createdStats;
    }
  }

  // Price discrepancy operations
  async getPriceDiscrepancies(): Promise<PriceDiscrepancy[]> {
    const discrepancies: PriceDiscrepancy[] = [];
    
    const discrepancyProducts = await db.select({
      id: products.id,
      sku: products.sku,
      title: products.title,
      shopifyPrice: products.shopifyPrice,
      costPrice: products.costPrice,  // Explicitly include costPrice
      supplierPrice: products.supplierPrice,
      vendor: products.vendor,
      productType: products.productType
    })
      .from(products)
      .where(and(
        eq(products.hasPriceDiscrepancy, true),
        isNotNull(products.supplierPrice)
      ));
    
    for (const product of discrepancyProducts) {
      if (product.supplierPrice !== null) {
        const difference = product.supplierPrice - product.shopifyPrice;
        const percentageDifference = (difference / product.shopifyPrice) * 100;
        
        discrepancies.push({
          sku: product.sku,
          title: product.title,
          shopifyPrice: product.shopifyPrice,
          supplierPrice: product.supplierPrice,
          difference,
          percentageDifference,
          productId: product.id,
          costPrice: product.costPrice,  // Include costPrice in the result
          vendor: product.vendor,
          productType: product.productType
        });
      }
    }
    
    return discrepancies.sort((a, b) => 
      Math.abs(b.percentageDifference) - Math.abs(a.percentageDifference)
    );
  }
  
  async clearPriceDiscrepancies(): Promise<number> {
    try {
      // First, get products with price discrepancies
      const discrepancyProducts = await db.select({ id: products.id })
        .from(products)
        .where(eq(products.hasPriceDiscrepancy, true));
        
      const discrepancyIds = discrepancyProducts.map(p => p.id);
      
      if (discrepancyIds.length === 0) {
        return 0; // No discrepancies to clear
      }
      
      // Only reset the hasPriceDiscrepancy flag without clearing supplier data
      // This way, the scheduler can still check these URLs in the future
      const now = new Date();
      const result = await db.update(products)
        .set({
          hasPriceDiscrepancy: false,
          updatedAt: now
        })
        .where(
          eq(products.hasPriceDiscrepancy, true)
        )
        .returning({ id: products.id });
      
      console.log(`Cleared price discrepancies for ${result.length} products`);
      return result.length;
    } catch (error) {
      console.error('Error clearing price discrepancies:', error);
      return 0;
    }
  }

  // Sale campaign operations
  async getSaleCampaigns(limit: number, offset: number): Promise<SaleCampaign[]> {
    return await db.select()
      .from(saleCampaigns)
      .orderBy(desc(saleCampaigns.id))
      .limit(limit)
      .offset(offset);
  }

  async getActiveSaleCampaigns(): Promise<SaleCampaign[]> {
    const now = new Date();
    return await db.select()
      .from(saleCampaigns)
      .where(
        and(
          eq(saleCampaigns.status, 'active'),
          sql`${saleCampaigns.startDate} <= ${now}`,
          sql`${saleCampaigns.endDate} >= ${now}`
        )
      )
      .orderBy(asc(saleCampaigns.endDate));
  }

  async getSaleCampaignById(id: number): Promise<SaleCampaign | undefined> {
    const result = await db.select().from(saleCampaigns).where(eq(saleCampaigns.id, id));
    return result[0];
  }

  async createSaleCampaign(campaign: InsertSaleCampaign): Promise<SaleCampaign> {
    const [createdCampaign] = await db.insert(saleCampaigns).values({
      ...campaign,
      status: campaign.status || 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    return createdCampaign;
  }

  async updateSaleCampaign(id: number, campaignData: Partial<SaleCampaign>): Promise<SaleCampaign | undefined> {
    try {
      const updateData: Record<string, any> = {
        ...campaignData,
        updatedAt: new Date()
      };
      
      const [updatedCampaign] = await db.update(saleCampaigns)
        .set(updateData)
        .where(eq(saleCampaigns.id, id))
        .returning();
      
      return updatedCampaign;
    } catch (error) {
      console.error(`Error updating sale campaign ${id}:`, error);
      return undefined;
    }
  }

  async deleteSaleCampaign(id: number): Promise<boolean> {
    try {
      // First delete all targets associated with this campaign
      await db.delete(saleCampaignTargets)
        .where(eq(saleCampaignTargets.campaignId, id));
      
      // Then delete the campaign itself
      const result = await db.delete(saleCampaigns)
        .where(eq(saleCampaigns.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting sale campaign ${id}:`, error);
      return false;
    }
  }

  async addSaleCampaignTarget(target: InsertSaleCampaignTarget): Promise<SaleCampaignTarget> {
    const [createdTarget] = await db.insert(saleCampaignTargets).values({
      ...target,
      createdAt: new Date()
    }).returning();
    
    return createdTarget;
  }

  async getSaleCampaignTargets(campaignId: number): Promise<SaleCampaignTarget[]> {
    return await db.select()
      .from(saleCampaignTargets)
      .where(eq(saleCampaignTargets.campaignId, campaignId));
  }

  async removeSaleCampaignTarget(id: number): Promise<boolean> {
    try {
      const result = await db.delete(saleCampaignTargets)
        .where(eq(saleCampaignTargets.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error removing sale campaign target ${id}:`, error);
      return false;
    }
  }

  async applySaleCampaign(campaignId: number): Promise<number> {
    try {
      const campaign = await this.getSaleCampaignById(campaignId);
      if (!campaign) return 0;
      
      const targets = await this.getSaleCampaignTargets(campaignId);
      if (targets.length === 0) return 0;
      
      let affectedProductCount = 0;
      const now = new Date();
      
      // Process each target type
      for (const target of targets) {
        let targetProducts: Product[] = [];
        
        if (target.targetType === 'sku') {
          // Single product by SKU
          const product = await this.getProductBySku(target.targetValue);
          if (product) targetProducts = [product];
        } else if (target.targetType === 'vendor') {
          // All products by vendor
          targetProducts = await db.select()
            .from(products)
            .where(eq(products.vendor, target.targetValue));
        } else if (target.targetType === 'product_type') {
          // All products by product type
          targetProducts = await db.select()
            .from(products)
            .where(eq(products.productType, target.targetValue));
        } else if (target.targetType === 'tag') {
          // Handle tags if implemented
          continue;
        }
        
        // Apply discount to each product
        for (const product of targetProducts) {
          // Record original price in history
          await this.createPriceHistory({
            productId: product.id,
            shopifyPrice: product.shopifyPrice,
            supplierPrice: product.supplierPrice,
            notes: `Sale campaign #${campaignId} applied: ${campaign.name}`
          });
          
          // Calculate the new price
          let newPrice = product.shopifyPrice;
          
          if (campaign.discountType === 'percentage') {
            // Apply percentage discount
            const discountAmount = product.shopifyPrice * (campaign.discountValue / 100);
            newPrice = product.shopifyPrice - discountAmount;
          } else if (campaign.discountType === 'fixed_amount') {
            // Apply fixed amount discount
            newPrice = product.shopifyPrice - campaign.discountValue;
          } else if (campaign.discountType === 'new_price') {
            // Set specific price
            newPrice = campaign.discountValue;
          }
          
          // Ensure price doesn't go below zero
          newPrice = Math.max(newPrice, 0);
          
          // Update the product with the new price
          await this.updateProduct(product.id, {
            shopifyPrice: newPrice,
            onSale: true,
            originalPrice: product.shopifyPrice,
            saleEndDate: campaign.endDate,
            saleId: campaign.id
          });
          
          affectedProductCount++;
        }
      }
      
      // Update campaign status to active
      await this.updateSaleCampaign(campaignId, { 
        status: 'active', 
        appliedAt: now 
      });
      
      return affectedProductCount;
    } catch (error) {
      console.error(`Error applying sale campaign ${campaignId}:`, error);
      return 0;
    }
  }

  async revertSaleCampaign(campaignId: number): Promise<number> {
    try {
      // Find all products that are on sale with this campaign ID
      const productsOnSale = await db.select()
        .from(products)
        .where(
          and(
            eq(products.onSale, true),
            eq(products.saleId, campaignId)
          )
        );
      
      let revertedCount = 0;
      const now = new Date();
      
      for (const product of productsOnSale) {
        // Only revert if there's an original price
        if (product.originalPrice) {
          // Create price history entry for the reversion
          await this.createPriceHistory({
            productId: product.id,
            shopifyPrice: product.shopifyPrice,
            supplierPrice: product.supplierPrice,
            notes: `Sale campaign #${campaignId} reverted`
          });
          
          // Restore the original price
          await this.updateProduct(product.id, {
            shopifyPrice: product.originalPrice,
            onSale: false,
            originalPrice: null,
            saleEndDate: null,
            saleId: null
          });
          
          revertedCount++;
        }
      }
      
      // Mark the campaign as completed
      await this.updateSaleCampaign(campaignId, { 
        status: 'completed', 
        completedAt: now 
      });
      
      return revertedCount;
    } catch (error) {
      console.error(`Error reverting sale campaign ${campaignId}:`, error);
      return 0;
    }
  }
  
  // Sync progress operations
  async initializeShopifySyncProgress(): Promise<SyncProgress> {
    // Delete any existing "shopify-sync" progress records that are pending or in-progress
    await db.delete(syncProgress)
      .where(and(
        eq(syncProgress.type, "shopify-sync"),
        sql`${syncProgress.status} IN ('pending', 'in-progress')`
      ));
    
    // Create a new progress record
    const [progress] = await db.insert(syncProgress).values({
      type: "shopify-sync",
      status: "pending",
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      message: "Shopify sync initialized and ready to start"
    }).returning();
    
    return progress;
  }
  
  async updateShopifySyncProgress(progressData: Partial<SyncProgress>): Promise<SyncProgress | undefined> {
    // Get the most recent shopify sync progress
    const [currentProgress] = await db
      .select()
      .from(syncProgress)
      .where(eq(syncProgress.type, "shopify-sync"))
      .orderBy(desc(syncProgress.id))
      .limit(1);
    
    if (!currentProgress) return undefined;
    
    // Calculate percentage complete
    const percentage = progressData.totalItems && progressData.processedItems
      ? Math.round((progressData.processedItems / progressData.totalItems) * 100)
      : undefined;
    
    // If status is being updated to "complete", set the completedAt date
    const completedAt = progressData.status === "complete" ? new Date() : undefined;
    
    // Update the progress
    const [updatedProgress] = await db
      .update(syncProgress)
      .set({
        ...progressData,
        completedAt,
        details: {
          ...currentProgress.details,
          percentage,
          ...(progressData.details || {})
        }
      })
      .where(eq(syncProgress.id, currentProgress.id))
      .returning();
    
    return updatedProgress;
  }
  
  async getShopifySyncProgress(): Promise<SyncProgress | null> {
    // Get the most recent shopify sync progress
    const [progress] = await db
      .select()
      .from(syncProgress)
      .where(eq(syncProgress.type, "shopify-sync"))
      .orderBy(desc(syncProgress.id))
      .limit(1);
    
    return progress || null;
  }
  
  /**
   * Get recent Shopify API logs for analyzing sync progress
   * @param limit The maximum number of logs to retrieve
   */
  async getRecentShopifyLogs(limit: number = 20): Promise<ShopifyLog[]> {
    try {
      // Get recent shopify logs, ordered by creation time descending (newest first)
      const results = await db.select()
        .from(shopifyLogs)
        .orderBy(desc(shopifyLogs.createdAt))
        .limit(limit);
        
      return results;
    } catch (error) {
      console.error('Error getting recent Shopify logs:', error);
      return [];
    }
  }
  
  async createShopifyLog(message: string, level: string = 'info', metadata: Record<string, any> = {}): Promise<ShopifyLog> {
    try {
      const logData = {
        message,
        level,
        metadata,
        createdAt: new Date()
      };
      
      const [createdLog] = await db.insert(shopifyLogs)
        .values(logData)
        .returning();
        
      console.log(`Created Shopify log: ${message}`);
      return createdLog;
    } catch (error) {
      console.error('Error creating Shopify log:', error);
      // Return a minimal log object so the calling code doesn't break
      return {
        id: -1,
        message,
        level,
        createdAt: new Date(),
        metadata
      };
    }
  }
}

// Use Database storage
export const storage = new DatabaseStorage();
