import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  telegramChatId: text("telegram_chat_id"),
  shopifyApiKey: text("shopify_api_key"),
  shopifyApiSecret: text("shopify_api_secret"),
  shopifyStoreUrl: text("shopify_store_url"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  shopifyId: text("shopify_id").notNull(),
  shopifyPrice: real("shopify_price").notNull(),
  costPrice: real("cost_price"), // Cost price from Shopify
  supplierUrl: text("supplier_url"),
  supplierPrice: real("supplier_price"),
  lastScraped: timestamp("last_scraped"),
  lastChecked: timestamp("last_checked"),
  hasPriceDiscrepancy: boolean("has_price_discrepancy").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  status: text("status").default("active"),
  images: jsonb("images").$type<string[]>(),
  vendor: text("vendor"),
  productType: text("product_type"),
  // Sale related fields
  onSale: boolean("on_sale").default(false),
  originalPrice: real("original_price"),
  saleEndDate: timestamp("sale_end_date"),
  saleId: integer("sale_id"),
});

export const priceHistories = pgTable("price_histories", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  shopifyPrice: real("shopify_price").notNull(),
  supplierPrice: real("supplier_price"),
  notes: text("notes"), // Optional notes about this price change
  createdAt: timestamp("created_at").defaultNow(),
});

export const csvUploads = pgTable("csv_uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  recordsCount: integer("records_count").notNull(),
  processedCount: integer("processed_count").notNull(),
  status: text("status").notNull(),
  updatedProductIds: jsonb("updated_product_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  message: text("message").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const stats = pgTable("stats", {
  id: serial("id").primaryKey(),
  totalOrders: integer("total_orders").default(0),
  todayOrders: integer("today_orders").default(0),
  averageOrderPrice: real("average_order_price").default(0),
  totalShipments: integer("total_shipments").default(0),
  todayShipments: integer("today_shipments").default(0),
  totalShippingCost: real("total_shipping_cost").default(0),
  totalRevenue: real("total_revenue").default(0),
  totalProfit: real("total_profit").default(0),
  newCustomers: integer("new_customers").default(0),
  // newProductsCount field removed
  salesChannels: jsonb("sales_channels").default({}),
  geoDistribution: jsonb("geo_distribution").default({}),
  // Price check metrics
  lastPriceCheck: timestamp("last_price_check"),
  totalPriceChecks: integer("total_price_checks").default(0),
  totalDiscrepanciesFound: integer("total_discrepancies_found").default(0),
  // Shopify sync metrics
  lastShopifySync: timestamp("last_shopify_sync"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Enum for discount types
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount', 'new_price']);

// Table for sale campaigns
export const saleCampaigns = pgTable("sale_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: real("discount_value").notNull(),
  status: text("status").default("draft"), // draft, active, completed, cancelled
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  appliedAt: timestamp("applied_at"),
  completedAt: timestamp("completed_at"),
  shopifyDiscountId: text("shopify_discount_id"), // Store Shopify discount ID if applicable
  originalPrices: jsonb("original_prices").$type<Record<string, number>>().default({}), // Store original prices to revert
});

// Table for sale campaign targets (products or vendors)
export const saleCampaignTargets = pgTable("sale_campaign_targets", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => saleCampaigns.id),
  targetType: text("target_type").notNull(), // sku, vendor, product_type, tag
  targetId: integer("target_id"), // product ID if targeting specific product
  targetValue: text("target_value"), // vendor name, product type, SKU, or tag value
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPriceHistorySchema = createInsertSchema(priceHistories).omit({ id: true, createdAt: true });
export const insertCsvUploadSchema = createInsertSchema(csvUploads).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true, sentAt: true });
export const insertStatsSchema = createInsertSchema(stats).omit({ id: true, lastUpdated: true });
export const insertSaleCampaignSchema = createInsertSchema(saleCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleCampaignTargetSchema = createInsertSchema(saleCampaignTargets).omit({ id: true, createdAt: true });

// Define relations
export const productsRelations = relations(products, ({ many }) => ({
  priceHistories: many(priceHistories),
  notifications: many(notifications),
}));

export const priceHistoriesRelations = relations(priceHistories, ({ one }) => ({
  product: one(products, { fields: [priceHistories.productId], references: [products.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  product: one(products, { fields: [notifications.productId], references: [products.id] }),
}));

export const saleCampaignsRelations = relations(saleCampaigns, ({ many }) => ({
  targets: many(saleCampaignTargets),
}));

export const saleCampaignTargetsRelations = relations(saleCampaignTargets, ({ one }) => ({
  campaign: one(saleCampaigns, { fields: [saleCampaignTargets.campaignId], references: [saleCampaigns.id] }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type PriceHistory = typeof priceHistories.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;

export type CsvUpload = typeof csvUploads.$inferSelect;
export type InsertCsvUpload = z.infer<typeof insertCsvUploadSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Stats = typeof stats.$inferSelect;
export type InsertStats = z.infer<typeof insertStatsSchema>;

export type SaleCampaign = typeof saleCampaigns.$inferSelect;
export type InsertSaleCampaign = z.infer<typeof insertSaleCampaignSchema>;

export type SaleCampaignTarget = typeof saleCampaignTargets.$inferSelect;
export type InsertSaleCampaignTarget = z.infer<typeof insertSaleCampaignTargetSchema>;
