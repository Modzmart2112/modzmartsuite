import { pgTable, text, serial, integer, boolean, jsonb, timestamp, real } from "drizzle-orm/pg-core";
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
  supplierUrl: text("supplier_url"),
  supplierPrice: real("supplier_price"),
  lastScraped: timestamp("last_scraped"),
  hasPriceDiscrepancy: boolean("has_price_discrepancy").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  status: text("status").default("active"),
  images: jsonb("images").$type<string[]>(),
  vendor: text("vendor"),
  productType: text("product_type"),
});

export const priceHistories = pgTable("price_histories", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id),
  shopifyPrice: real("shopify_price").notNull(),
  supplierPrice: real("supplier_price"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const csvUploads = pgTable("csv_uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  recordsCount: integer("records_count").notNull(),
  processedCount: integer("processed_count").notNull(),
  status: text("status").notNull(),
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
  salesChannels: jsonb("sales_channels").default({}),
  geoDistribution: jsonb("geo_distribution").default({}),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPriceHistorySchema = createInsertSchema(priceHistories).omit({ id: true, createdAt: true });
export const insertCsvUploadSchema = createInsertSchema(csvUploads).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true, sentAt: true });
export const insertStatsSchema = createInsertSchema(stats).omit({ id: true, lastUpdated: true });

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
