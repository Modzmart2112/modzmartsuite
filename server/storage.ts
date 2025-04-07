import { 
  User, InsertUser, Product, InsertProduct, 
  PriceHistory, InsertPriceHistory, CsvUpload, 
  InsertCsvUpload, Notification, InsertNotification,
  Stats, InsertStats, users, products, priceHistories,
  csvUploads, notifications, stats
} from "@shared/schema";
import { PriceDiscrepancy } from "@shared/types";
import { db } from "./db";
import { eq, desc, and, asc, isNotNull, sql } from "drizzle-orm";

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
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private priceHistories: Map<number, PriceHistory>;
  private csvUploads: Map<number, CsvUpload>;
  private notifications: Map<number, Notification>;
  private stats: Stats | undefined;
  private additionalStats: Record<string, any>;
  
  private userIdCounter: number;
  private productIdCounter: number;
  private priceHistoryIdCounter: number;
  private csvUploadIdCounter: number;
  private notificationIdCounter: number;

  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.priceHistories = new Map();
    this.csvUploads = new Map();
    this.notifications = new Map();
    
    this.userIdCounter = 1;
    this.productIdCounter = 1;
    this.priceHistoryIdCounter = 1;
    this.csvUploadIdCounter = 1;
    this.notificationIdCounter = 1;
    
    // Initialize with default stats
    const now = new Date();
    
    // Initialize additionalStats with default values
    this.additionalStats = {
      newProductsCount: 235,
      offMarketCount: 45,
      withSupplierUrlCount: 859,
      priceDiscrepancyCount: 12,
      productCount: 1604,
      activeProductCount: 1452,
      // Add extra fields for connected apps/services
      connected: false,
      activeJobs: [],
      scheduledTasks: []
    };
    
    // Ensure we have default values for all required fields
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
      totalPriceChecks: 2384,
      totalDiscrepanciesFound: 127,
      lastPriceCheck: now,
      lastShopifySync: now,
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
      lastUpdated: now
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

  async createProduct(productData: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const now = new Date();
    
    // Ensure images is properly converted to an array if it's not already
    let images: string[] = [];
    if (productData.images) {
      if (Array.isArray(productData.images)) {
        images = [...productData.images]; // Make a copy to ensure it's a new array
      } else if (typeof productData.images === 'string') {
        // Handle the case where images might be a comma-separated string
        images = productData.images.split(',').map((img: string) => img.trim());
      }
    }
    
    // Create a properly typed product object with all required fields
    const product: Product = { 
      id,
      sku: productData.sku,
      title: productData.title,
      shopifyId: productData.shopifyId,
      shopifyPrice: productData.shopifyPrice,
      status: productData.status || null,
      description: productData.description || null,
      supplierUrl: productData.supplierUrl || null,
      supplierPrice: productData.supplierPrice || null,
      lastScraped: productData.lastScraped || null,
      lastChecked: productData.lastChecked || null,
      hasPriceDiscrepancy: productData.hasPriceDiscrepancy || false,
      images: images,
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
    
    // Ensure updatedProductIds is properly handled as array
    let updatedIds: number[] = [];
    if (uploadData.updatedProductIds) {
      if (Array.isArray(uploadData.updatedProductIds)) {
        updatedIds = [...uploadData.updatedProductIds]; // Create a copy
      } else if (typeof uploadData.updatedProductIds === 'string') {
        updatedIds = uploadData.updatedProductIds.split(',').map((id: string) => parseInt(id.trim(), 10));
      }
    }
    
    const upload: CsvUpload = { 
      ...uploadData, 
      id,
      updatedProductIds: updatedIds,
      createdAt: new Date()
    };
    this.csvUploads.set(id, upload);
    return upload;
  }

  async updateCsvUpload(id: number, uploadData: Partial<CsvUpload>): Promise<CsvUpload | undefined> {
    const existingUpload = this.csvUploads.get(id);
    if (!existingUpload) return undefined;
    
    // Handle updatedProductIds properly if it exists in the update data
    if (uploadData.updatedProductIds) {
      // Ensure we have an array by properly handling various input types
      let updatedIds: number[] = [];
      
      if (Array.isArray(uploadData.updatedProductIds)) {
        updatedIds = [...uploadData.updatedProductIds]; // Create a copy
      } else if (typeof uploadData.updatedProductIds === 'string') {
        // Handle the case where it might be a comma-separated string
        updatedIds = uploadData.updatedProductIds.split(',').map((id: string) => parseInt(id.trim(), 10));
      }
      
      // Create a modified upload data object with the proper array
      const modifiedUploadData = {
        ...uploadData,
        updatedProductIds: updatedIds
      };
      
      const updatedUpload = { ...existingUpload, ...modifiedUploadData };
      this.csvUploads.set(id, updatedUpload);
      return updatedUpload;
    } else {
      // Regular update without touching updatedProductIds
      const updatedUpload = { ...existingUpload, ...uploadData };
      this.csvUploads.set(id, updatedUpload);
      return updatedUpload;
    }
  }

  async getRecentCsvUploads(limit: number): Promise<CsvUpload[]> {
    return Array.from(this.csvUploads.values())
      .sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
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
  async getStats(): Promise<Stats & Record<string, any>> {
    // Combine standard stats with additional stats
    return {
      ...this.stats,
      ...this.additionalStats
    };
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
    return await db.select()
      .from(products)
      .orderBy(desc(products.id))
      .limit(limit)
      .offset(offset);
  }

  async getProductCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(products);
    return Number(result[0].count);
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
    
    // Normalize all the SKUs by trimming and converting to uppercase
    const normalizedSkus = skus.map(sku => sku.trim().toUpperCase());
    
    // Build a query that uses UPPER() function for case-insensitive matching
    return await db.select()
      .from(products)
      .where(sql`UPPER(${products.sku}) IN (${sql.join(normalizedSkus)})`);
  }

  async getProductById(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    // Normalize the SKU by trimming and converting to uppercase for consistent matching
    const normalizedSku = sku.trim().toUpperCase();
    
    // First try exact matching
    let result = await db.select().from(products).where(sql`UPPER(${products.sku}) = ${normalizedSku}`);
    
    if (result.length > 0) {
      return result[0];
    }
    
    // If no exact match, try a more fuzzy match (removing any spaces)
    const noSpaceSku = normalizedSku.replace(/\s+/g, '');
    result = await db.select().from(products).where(sql`REPLACE(UPPER(${products.sku}), ' ', '') = ${noSpaceSku}`);
    
    if (result.length > 0) {
      console.log(`Found product by fuzzy SKU match: "${sku}" matched with "${result[0].sku}"`);
    }
    
    return result[0];
  }
  
  async getProductsWithSupplierUrls(): Promise<Product[]> {
    return await db.select()
      .from(products)
      .where(
        and(
          isNotNull(products.supplierUrl),
          sql`${products.supplierUrl} != ''`
        )
      )
      .orderBy(asc(products.id));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [createdProduct] = await db.insert(products).values(product).returning();
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
    const searchTerm = `%${query.trim()}%`;
    
    return await db.select()
      .from(products)
      .where(
        sql`LOWER(${products.sku}) LIKE LOWER(${searchTerm}) OR LOWER(${products.title}) LIKE LOWER(${searchTerm})`
      )
      .orderBy(desc(products.id))
      .limit(limit)
      .offset(offset);
  }
  
  async searchProductCount(query: string): Promise<number> {
    const searchTerm = `%${query.trim()}%`;
    
    const result = await db.select({ count: sql`count(*)` })
      .from(products)
      .where(
        sql`LOWER(${products.sku}) LIKE LOWER(${searchTerm}) OR LOWER(${products.title}) LIKE LOWER(${searchTerm})`
      );
      
    return Number(result[0].count);
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
  async getStats(): Promise<Stats & Record<string, any>> {
    const existingStats = await db.select().from(stats).limit(1);
    const baseStats = existingStats[0];
    
    if (!baseStats) return {} as Stats & Record<string, any>;
    
    // Get additional stats from the database
    const [productCount] = await db.select({ count: sql`count(*)` }).from(products);
    const [activeProductCount] = await db.select({ count: sql`count(*)` })
      .from(products)
      .where(eq(products.status, 'active'));
    const [withSupplierUrlCount] = await db.select({ count: sql`count(*)` })
      .from(products)
      .where(and(isNotNull(products.supplierUrl), sql`${products.supplierUrl} != ''`));
    const [priceDiscrepancyCount] = await db.select({ count: sql`count(*)` })
      .from(products)
      .where(eq(products.hasPriceDiscrepancy, true));
    
    // Calculate derived stats
    const offMarketCount = Number(productCount.count) - Number(activeProductCount.count);
    
    // Add extra stats that aren't in the schema but needed for the UI
    const additionalStats = {
      newProductsCount: 235, // This could be calculated based on createdAt dates
      offMarketCount: offMarketCount,
      withSupplierUrlCount: Number(withSupplierUrlCount.count),
      priceDiscrepancyCount: Number(priceDiscrepancyCount.count),
      productCount: Number(productCount.count),
      activeProductCount: Number(activeProductCount.count),
    };
    
    // Return combined stats
    return {
      ...baseStats,
      ...additionalStats
    };
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
    
    const discrepancyProducts = await db.select()
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
          productId: product.id
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
}

// Use Memory storage for now
export const storage = new MemStorage();
