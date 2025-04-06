import { 
  User, InsertUser, Product, InsertProduct, 
  PriceHistory, InsertPriceHistory, CsvUpload, 
  InsertCsvUpload, Notification, InsertNotification,
  Stats, InsertStats
} from "@shared/schema";
import { PriceDiscrepancy } from "@shared/types";

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
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  
  // Price history operations
  createPriceHistory(history: InsertPriceHistory): Promise<PriceHistory>;
  getPriceHistoryByProductId(productId: number, limit: number): Promise<PriceHistory[]>;
  
  // CSV upload operations
  createCsvUpload(upload: InsertCsvUpload): Promise<CsvUpload>;
  updateCsvUpload(id: number, upload: Partial<CsvUpload>): Promise<CsvUpload | undefined>;
  getRecentCsvUploads(limit: number): Promise<CsvUpload[]>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, notification: Partial<Notification>): Promise<Notification | undefined>;
  getPendingNotifications(): Promise<Notification[]>;
  
  // Stats operations
  getStats(): Promise<Stats | undefined>;
  updateStats(stats: Partial<Stats>): Promise<Stats | undefined>;
  
  // Price discrepancy operations
  getPriceDiscrepancies(): Promise<PriceDiscrepancy[]>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private priceHistories: Map<number, PriceHistory>;
  private csvUploads: Map<number, CsvUpload>;
  private notifications: Map<number, Notification>;
  private stats: Stats | undefined;
  
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
    const user: User = { ...userData, id };
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

  async createProduct(productData: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const now = new Date();
    const product: Product = { 
      ...productData, 
      id,
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

  // Price history operations
  async createPriceHistory(historyData: InsertPriceHistory): Promise<PriceHistory> {
    const id = this.priceHistoryIdCounter++;
    const history: PriceHistory = { 
      ...historyData, 
      id,
      createdAt: new Date()
    };
    this.priceHistories.set(id, history);
    return history;
  }

  async getPriceHistoryByProductId(productId: number, limit: number): Promise<PriceHistory[]> {
    return Array.from(this.priceHistories.values())
      .filter(history => history.productId === productId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
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
    return Array.from(this.csvUploads.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const notification: Notification = { 
      ...notificationData, 
      id,
      createdAt: new Date()
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
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
}

export const storage = new MemStorage();
