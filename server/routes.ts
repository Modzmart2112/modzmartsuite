import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { CsvRecord, ScrapedPriceResult } from "@shared/types";
import { insertProductSchema, insertCsvUploadSchema, User, Product, products } from "@shared/schema";
import { shopifyClient } from "./shopify";
import { scrapePriceFromUrl } from "./scraper";
import { sendTelegramNotification } from "./telegram";
import { ZodError } from "zod";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import path from "path";
import os from "os";


// Helper function to handle controller errors
const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error("Error:", error);
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Server error" });
      }
    }
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  const upload = multer({ dest: os.tmpdir() });
  
  // API Routes
  
  // User routes
  app.post("/api/auth/login", asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }
    
    const user = await storage.getUserByUsername(username);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // In a real app, we'd use a secure authentication method
    res.json({ id: user.id, username: user.username });
  }));
  
  // Dashboard stats
  app.get("/api/dashboard/stats", asyncHandler(async (req, res) => {
    const stats = await storage.getStats();
    const productCount = await storage.getProductCount();
    const activeProductCount = await storage.getActiveProductCount();
    
    if (!stats) {
      return res.status(404).json({ message: "Stats not found" });
    }
    
    // Format stats for the frontend
    const salesChannels = stats.salesChannels ? (stats.salesChannels as any).channels || [] : [];
    const geoDistribution = stats.geoDistribution ? (stats.geoDistribution as any).countries || [] : [];
    
    res.json({
      totalOrders: stats.totalOrders,
      todayOrders: stats.todayOrders,
      averageOrderPrice: stats.averageOrderPrice,
      totalShipments: stats.totalShipments,
      todayShipments: stats.todayShipments,
      totalShippingCost: stats.totalShippingCost,
      totalRevenue: stats.totalRevenue,
      revenueChange: 18.5, // Example value
      totalProfit: stats.totalProfit,
      profitChange: 16.6, // Example value
      newCustomers: stats.newCustomers,
      customersChange: 248, // Example value
      salesChannels,
      geoDistribution,
      productCount,
      activeProductCount,
      offMarketCount: productCount - activeProductCount,
      newProductsCount: 400, // Example value
      lastUpdated: stats.lastUpdated ? stats.lastUpdated.toISOString() : new Date().toISOString()
    });
  }));
  
  // Products routes
  app.get("/api/products", asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string || "50");
    const offset = parseInt(req.query.offset as string || "0");
    
    const products = await storage.getProducts(limit, offset);
    const total = await storage.getProductCount();
    
    res.json({ products, total });
  }));
  
  app.get("/api/products/discrepancies", asyncHandler(async (req, res) => {
    const discrepancies = await storage.getPriceDiscrepancies();
    res.json(discrepancies);
  }));
  
  // Endpoint to clear all price discrepancies
  app.post("/api/products/discrepancies/clear", asyncHandler(async (req, res) => {
    const clearedCount = await storage.clearPriceDiscrepancies();
    res.json({ 
      success: true, 
      message: `Successfully cleared ${clearedCount} price discrepancies`, 
      count: clearedCount 
    });
  }));
  
  // Endpoint to clear a single price discrepancy by product ID
  app.post("/api/products/discrepancies/:productId/clear", asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    
    const product = await storage.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Create a new price history record that sets supplierPrice = shopifyPrice
    await storage.createPriceHistory({
      productId,
      shopifyPrice: product.shopifyPrice,
      supplierPrice: product.shopifyPrice, // Match supplier price to shopify price to clear discrepancy
    });
    
    // Update the product to clear the discrepancy flag
    await storage.updateProduct(productId, {
      hasPriceDiscrepancy: false,
      supplierPrice: null,
      supplierUrl: null
    });
    
    console.log(`Cleared price discrepancy for product ID ${productId}`);
    
    res.json({ 
      success: true, 
      message: `Successfully cleared price discrepancy for ${product.title}`, 
      productId
    });
  }));
  
  // Debug route to test price scraping
  app.get("/api/scrape-test", asyncHandler(async (req, res) => {
    const url = req.query.url as string;
    
    if (!url) {
      return res.status(400).json({ message: "URL parameter is required" });
    }
    
    try {
      console.log(`Testing scrape for URL: ${url}`);
      const result = await scrapePriceFromUrl(url);
      
      // Log the raw HTML content if needed for debugging
      if (req.query.debug === 'true') {
        try {
          const response = await fetch(url);
          const html = await response.text();
          
          // Return first 1000 chars of HTML for diagnosis
          result.htmlSample = html.substring(0, 1000);
        } catch (error) {
          console.error(`Failed to fetch HTML content: ${error}`);
        }
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: "Scraping failed", 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }));
  
  // Manual scraping of a URL for testing
  app.post("/api/products/scrape-price", asyncHandler(async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }
    
    try {
      const result = await scrapePriceFromUrl(url);
      res.json(result);
    } catch (error) {
      console.error("Error scraping price:", error);
      res.status(500).json({ 
        message: "Failed to scrape price", 
        error: (error as Error).message,
        url 
      });
    }
  }));
  
  // Rescrape a product's supplier price
  app.post("/api/products/:id/rescrape", asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    
    const product = await storage.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    if (!product.supplierUrl) {
      return res.status(400).json({ message: "Product has no supplier URL to scrape" });
    }
    
    try {
      // Scrape the price
      const scrapeResult = await scrapePriceFromUrl(product.supplierUrl);
      
      if (scrapeResult.price === null) {
        return res.status(400).json({ 
          message: "Failed to extract price from supplier website",
          error: scrapeResult.error || "No price found"
        });
      }
      
      // Check for price discrepancy
      const hasPriceDiscrepancy = Math.abs(scrapeResult.price - product.shopifyPrice) > 0.01;
      
      // Update the product with the scraped price
      const updatedProduct = await storage.updateProduct(product.id, {
        supplierPrice: scrapeResult.price,
        lastScraped: new Date(),
        hasPriceDiscrepancy
      });
      
      // Record the price history
      await storage.createPriceHistory({
        productId: product.id,
        shopifyPrice: product.shopifyPrice,
        supplierPrice: scrapeResult.price
      });
      
      res.json({
        success: true,
        product: updatedProduct,
        originalPrice: product.supplierPrice,
        newPrice: scrapeResult.price,
        hasPriceDiscrepancy
      });
    } catch (error) {
      console.error(`Error rescraping product ${productId}:`, error);
      res.status(500).json({ 
        message: "Failed to rescrape product", 
        error: (error as Error).message,
      });
    }
  }));
  
  app.post("/api/products/update-price", asyncHandler(async (req, res) => {
    const { productId, newPrice } = req.body;
    
    if (!productId || typeof newPrice !== "number") {
      return res.status(400).json({ message: "Product ID and new price are required" });
    }
    
    const product = await storage.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Update the product price
    const updatedProduct = await storage.updateProduct(productId, {
      shopifyPrice: newPrice,
      hasPriceDiscrepancy: false
    });
    
    // In a real implementation, update the price in Shopify
    try {
      await shopifyClient.updateProductPrice(product.shopifyId, newPrice);
      
      // Create price history record
      await storage.createPriceHistory({
        productId,
        shopifyPrice: newPrice,
        supplierPrice: product.supplierPrice || 0
      });
      
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating Shopify price:", error);
      res.status(500).json({ message: "Failed to update Shopify price" });
    }
  }));
  
  // CSV upload routes
  app.post("/api/csv/upload", upload.array("files"), asyncHandler(async (req, res) => {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    
    const uploadResults = [];
    
    for (const file of req.files as Express.Multer.File[]) {
      const records: CsvRecord[] = [];
      
      // Process the CSV file
      try {
        const parsePromise = new Promise<CsvRecord[]>((resolve, reject) => {
          fs.createReadStream(file.path)
            .pipe(csvParser())
            .on("data", (data: any) => {
              // Map CSV columns to our expected format
              const record: CsvRecord = {
                sku: data.SKU || data.sku || "",
                originUrl: data["Origin URL"] || data["origin_url"] || data.originUrl || "",
                title: data.Title || data.title || "",
                cost: data["Cost per item"] || data.cost || "",
                price: data.Price || data.price || "",
                description: data.Description || data.description || ""
              };
              
              // Only add records with SKU and Origin URL
              if (record.sku && record.originUrl) {
                records.push(record);
              }
            })
            .on("end", () => {
              resolve(records);
            })
            .on("error", (error) => {
              reject(error);
            });
        });
        
        await parsePromise;
        
        // Create CSV upload record
        const csvUpload = await storage.createCsvUpload({
          filename: file.originalname,
          recordsCount: records.length,
          processedCount: 0,
          status: "pending"
        });
        
        // Process the records asynchronously
        processRecords(records, csvUpload.id).catch(console.error);
        
        uploadResults.push({
          filename: file.originalname,
          id: csvUpload.id,
          recordsCount: records.length
        });
      } catch (error) {
        console.error(`Error processing CSV file ${file.originalname}:`, error);
        uploadResults.push({
          filename: file.originalname,
          error: "Failed to process file"
        });
      } finally {
        // Clean up the temporary file
        fs.unlink(file.path, (err) => {
          if (err) console.error(`Error deleting temporary file ${file.path}:`, err);
        });
      }
    }
    
    res.json({ uploads: uploadResults });
  }));
  
  app.get("/api/csv/uploads", asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string || "10");
    const recentUploads = await storage.getRecentCsvUploads(limit);
    res.json({ uploads: recentUploads });
  }));
  
  // Delete a CSV upload
  app.delete("/api/csv/uploads/:id", asyncHandler(async (req, res) => {
    const uploadId = parseInt(req.params.id);
    
    if (isNaN(uploadId)) {
      return res.status(400).json({ message: "Invalid upload ID" });
    }
    
    // Get the CSV upload to delete
    const csvUploads = await storage.getRecentCsvUploads(100);
    const uploadToDelete = csvUploads.find(upload => upload.id === uploadId);
    
    if (!uploadToDelete) {
      return res.status(404).json({ message: "Upload not found" });
    }
    
    // Extract domain patterns from filename to help identify suppliers
    let domainPatterns: string[] = [];
    
    if (uploadToDelete.filename.toLowerCase().includes('artec')) {
      domainPatterns.push('%prospeedracing.com.au%');
    }
    
    if (uploadToDelete.filename.toLowerCase().includes('bilstein')) {
      domainPatterns.push('%bilstein%');
    }
    
    // Add more patterns for other suppliers in CSV files as needed
    
    // If we have domain patterns, use them to specifically target related products
    if (domainPatterns.length > 0) {
      console.log(`Resetting supplier data for patterns: ${domainPatterns.join(', ')}`);
      
      // Get all products
      const allProducts = await storage.getProducts(1000, 0);
      
      // Filter products that match any of the patterns
      for (const product of allProducts) {
        if (product.supplierUrl) {
          // Check if this product's URL matches any of our patterns
          const matchesPattern = domainPatterns.some(pattern => {
            // Convert SQL LIKE pattern (with % wildcards) to JavaScript RegExp
            const regexPattern = pattern
              .replace(/%/g, '.*')  // Convert % to .*
              .replace(/_/g, '.');  // Convert _ to .
            
            const regex = new RegExp(regexPattern, 'i');
            return regex.test(product.supplierUrl || '');
          });
          
          if (matchesPattern) {
            await storage.updateProduct(product.id, {
              supplierUrl: null,
              supplierPrice: null,
              hasPriceDiscrepancy: false
            });
          }
        }
      }
    } else {
      // If we can't identify specific supplier patterns, fall back to resetting all
      console.log(`No specific supplier pattern identified for ${uploadToDelete.filename}, resetting all supplier data`);
      const allProducts = await storage.getProducts(1000, 0);
      const productsWithSupplierInfo = allProducts.filter(p => p.supplierUrl !== null || p.supplierPrice !== null);
      
      for (const product of productsWithSupplierInfo) {
        await storage.updateProduct(product.id, {
          supplierUrl: null,
          supplierPrice: null,
          hasPriceDiscrepancy: false
        });
      }
    }
    
    // Now delete the CSV upload
    const result = await storage.deleteCsvUpload(uploadId);
    
    if (!result) {
      return res.status(404).json({ message: "CSV upload deletion failed" });
    }
    
    res.json({ success: true, message: "Upload deleted successfully and supplier prices reset" });
  }));
  
  // Cancel processing a CSV upload
  app.post("/api/csv/uploads/:id/cancel", asyncHandler(async (req, res) => {
    const uploadId = parseInt(req.params.id);
    
    if (isNaN(uploadId)) {
      return res.status(400).json({ message: "Invalid upload ID" });
    }
    
    // Get the CSV upload to cancel
    const csvUploads = await storage.getRecentCsvUploads(100);
    const uploadToCancel = csvUploads.find(upload => upload.id === uploadId);
    
    if (!uploadToCancel) {
      return res.status(404).json({ message: "Upload not found" });
    }
    
    // Extract domain patterns from filename to help identify suppliers
    let domainPatterns: string[] = [];
    
    if (uploadToCancel.filename.toLowerCase().includes('artec')) {
      domainPatterns.push('%prospeedracing.com.au%');
    }
    
    if (uploadToCancel.filename.toLowerCase().includes('bilstein')) {
      domainPatterns.push('%bilstein%');
    }
    
    // Add more patterns for other suppliers in CSV files as needed
    
    // If we have domain patterns, use them to specifically target related products
    if (domainPatterns.length > 0) {
      console.log(`Resetting supplier data for patterns: ${domainPatterns.join(', ')}`);
      
      // Get all products
      const allProducts = await storage.getProducts(1000, 0);
      
      // Filter products that match any of the patterns
      for (const product of allProducts) {
        if (product.supplierUrl) {
          // Check if this product's URL matches any of our patterns
          const matchesPattern = domainPatterns.some(pattern => {
            // Convert SQL LIKE pattern (with % wildcards) to JavaScript RegExp
            const regexPattern = pattern
              .replace(/%/g, '.*')  // Convert % to .*
              .replace(/_/g, '.');  // Convert _ to .
            
            const regex = new RegExp(regexPattern, 'i');
            return regex.test(product.supplierUrl || '');
          });
          
          if (matchesPattern) {
            await storage.updateProduct(product.id, {
              supplierUrl: null,
              supplierPrice: null,
              hasPriceDiscrepancy: false
            });
          }
        }
      }
    } else {
      // If we can't identify specific supplier patterns, fall back to resetting all
      console.log(`No specific supplier pattern identified for ${uploadToCancel.filename}, resetting all supplier data`);
      const allProducts = await storage.getProducts(1000, 0);
      const productsWithSupplierInfo = allProducts.filter(p => p.supplierUrl !== null || p.supplierPrice !== null);
      
      for (const product of productsWithSupplierInfo) {
        await storage.updateProduct(product.id, {
          supplierUrl: null,
          supplierPrice: null,
          hasPriceDiscrepancy: false
        });
      }
    }
    
    // Now update the CSV upload status
    const upload = await storage.updateCsvUpload(uploadId, { 
      status: 'cancelled',
      processedCount: 0
    });
    
    if (!upload) {
      return res.status(404).json({ message: "Failed to update upload status" });
    }
    
    res.json({ success: true, message: "Processing cancelled successfully and supplier prices reset" });
  }));
  
  app.get("/api/csv/status/:id", asyncHandler(async (req, res) => {
    const uploadId = parseInt(req.params.id);
    
    if (isNaN(uploadId)) {
      return res.status(400).json({ message: "Invalid upload ID" });
    }
    
    const uploads = await storage.getRecentCsvUploads(100);
    const upload = uploads.find(u => u.id === uploadId);
    
    if (!upload) {
      return res.status(404).json({ message: "Upload not found" });
    }
    
    res.json(upload);
  }));
  
  // Shopify connection routes
  app.post("/api/shopify/connect", asyncHandler(async (req, res) => {
    const { shopifyApiKey, shopifyApiSecret, shopifyStoreUrl } = req.body;
    
    if (!shopifyApiKey || !shopifyApiSecret || !shopifyStoreUrl) {
      return res.status(400).json({ message: "All Shopify credentials are required" });
    }
    
    try {
      // Test the connection
      await shopifyClient.testConnection(shopifyApiKey, shopifyApiSecret, shopifyStoreUrl);
      
      // Store credentials (in a real app, these would be securely stored)
      const user = await storage.getUser(1); // Simplified: using first user
      if (!user) {
        await storage.createUser({
          username: "admin",
          password: "admin",
          shopifyApiKey,
          shopifyApiSecret,
          shopifyStoreUrl
        });
      } else {
        await storage.updateUser(user.id, {
          shopifyApiKey,
          shopifyApiSecret,
          shopifyStoreUrl
        });
      }
      
      res.json({ success: true, message: "Shopify connection successful" });
    } catch (error) {
      console.error("Shopify connection error:", error);
      res.status(500).json({ message: "Failed to connect to Shopify" });
    }
  }));
  
  // Get Shopify connection status
  app.get("/api/shopify/status", asyncHandler(async (req, res) => {
    try {
      const user = await storage.getUser(1); // Simplified: using first user
      
      if (!user) {
        return res.status(404).json({ connected: false });
      }
      
      const isConnected = !!(user.shopifyApiKey && user.shopifyApiSecret && user.shopifyStoreUrl);
      res.json({ connected: isConnected });
    } catch (error) {
      console.error("Error getting Shopify connection status:", error);
      res.status(500).json({ message: "Failed to get connection status" });
    }
  }));
  
  // Sync products from Shopify
  app.post("/api/shopify/sync", asyncHandler(async (req, res) => {
    try {
      // Get the user's Shopify credentials
      const user = await storage.getUser(1); // Simplified: using first user
      
      if (!user || !user.shopifyApiKey || !user.shopifyApiSecret || !user.shopifyStoreUrl) {
        return res.status(400).json({ message: "Shopify connection not configured" });
      }
      
      // Start syncing products in the background
      syncShopifyProducts(user.shopifyApiKey, user.shopifyApiSecret, user.shopifyStoreUrl).catch(console.error);
      
      res.json({ success: true, message: "Product sync initiated" });
    } catch (error) {
      console.error("Error syncing products:", error);
      res.status(500).json({ message: "Failed to sync products" });
    }
  }));
  
  // Telegram connection routes
  app.post("/api/telegram/connect", asyncHandler(async (req, res) => {
    const { telegramChatId } = req.body;
    
    if (!telegramChatId) {
      return res.status(400).json({ message: "Telegram chat ID is required" });
    }
    
    try {
      // Test the connection
      await sendTelegramNotification(telegramChatId, "🔄 PriceSync connected successfully!");
      
      // Store the chat ID
      const user = await storage.getUser(1); // Simplified: using first user
      if (user) {
        await storage.updateUser(user.id, { telegramChatId });
      }
      
      res.json({ success: true, message: "Telegram connection successful" });
    } catch (error) {
      console.error("Telegram connection error:", error);
      res.status(500).json({ message: "Failed to connect to Telegram" });
    }
  }));
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}

// Helper functions for background processing

async function processRecords(records: CsvRecord[], uploadId: number): Promise<void> {
  try {
    // Update status to processing
    await storage.updateCsvUpload(uploadId, {
      status: "processing"
    });
    
    let processedCount = 0;
    let updatedProductCount = 0;
    let newProductCount = 0;
    
    for (const record of records) {
      try {
        // Ensure we have both SKU and Origin URL - these are required
        if (!record.sku || !record.originUrl) {
          console.warn(`Skipping record: Missing required SKU or Origin URL`);
          continue;
        }
        
        // Check if product exists
        let product = await storage.getProductBySku(record.sku);
        
        if (product) {
          // Update supplier URL if provided
          if (record.originUrl && record.originUrl !== product.supplierUrl) {
            product = await storage.updateProduct(product.id, {
              supplierUrl: record.originUrl
            });
            console.log(`Updated existing product SKU ${record.sku} with Origin URL: ${record.originUrl}`);
            updatedProductCount++;
          }
        } else {
          // If product doesn't exist in our database, try to find it in Shopify
          try {
            const user = await storage.getUser(1); // Simplified: using first user
            
            if (user?.shopifyApiKey && user?.shopifyApiSecret && user?.shopifyStoreUrl) {
              const shopifyProduct = await shopifyClient.getProductBySku(
                user.shopifyApiKey,
                user.shopifyApiSecret,
                user.shopifyStoreUrl,
                record.sku
              );
              
              if (shopifyProduct) {
                // Create product in our database
                product = await storage.createProduct({
                  sku: record.sku,
                  title: shopifyProduct.title || record.title || `Product ${record.sku}`,
                  description: shopifyProduct.description || record.description || '',
                  shopifyId: shopifyProduct.id,
                  shopifyPrice: shopifyProduct.price,
                  supplierUrl: record.originUrl,
                  images: shopifyProduct.images,
                  status: "active",
                  vendor: shopifyProduct.vendor || record.Vendor || '',
                  productType: shopifyProduct.productType || record["Product Type"] || ''
                });
                console.log(`Created new product from Shopify: SKU ${record.sku} with Origin URL: ${record.originUrl}`);
                newProductCount++;
              } else if (record.title && record.price) {
                // If not found in Shopify but we have basic data, create a placeholder product
                const price = parseFloat(record.price.replace(/[^0-9.]/g, ''));
                const cost = record.cost ? parseFloat(record.cost.replace(/[^0-9.]/g, '')) : null;
                
                product = await storage.createProduct({
                  sku: record.sku,
                  title: record.title,
                  description: record.description || '',
                  shopifyId: `local-${record.sku}`, // Placeholder ID
                  shopifyPrice: price || 0,
                  supplierPrice: cost || null,
                  supplierUrl: record.originUrl,
                  status: "inactive", // Mark as inactive since it's not in Shopify yet
                  vendor: record.Vendor || '',
                  productType: record["Product Type"] || ''
                });
                console.log(`Created placeholder product: SKU ${record.sku} with Origin URL: ${record.originUrl}`);
                newProductCount++;
              }
            }
          } catch (error) {
            console.error(`Error fetching Shopify product for SKU ${record.sku}:`, error);
          }
        }
        
        // If we have a product and a supplier URL, scrape the price
        if (product && product.supplierUrl) {
          try {
            const scrapeResult = await scrapePriceFromUrl(product.supplierUrl);
            
            if (scrapeResult.price !== null) {
              // Check for price discrepancy
              const hasPriceDiscrepancy = Math.abs(scrapeResult.price - product.shopifyPrice) > 0.01;
              
              // Update the product with the scraped price
              const updatedProduct = await storage.updateProduct(product.id, {
                supplierPrice: scrapeResult.price,
                lastScraped: new Date(),
                hasPriceDiscrepancy
              });
              
              // Record the price history
              await storage.createPriceHistory({
                productId: product.id,
                shopifyPrice: product.shopifyPrice,
                supplierPrice: scrapeResult.price
              });
              
              // Send notification if there's a price discrepancy
              if (hasPriceDiscrepancy) {
                const user = await storage.getUser(1); // Simplified: using first user
                
                if (user?.telegramChatId) {
                  // Format prices with commas for better readability
                  const formatPrice = (price: number): string => {
                    return price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    });
                  };
                  
                  const message = `🚨 Price Discrepancy Alert!\n\n` +
                    `Product: ${product.title}\n` +
                    `SKU: ${product.sku}\n` +
                    `Current Price: $${formatPrice(product.shopifyPrice)}\n` +
                    `Supplier Price: $${formatPrice(scrapeResult.price)}\n` +
                    `Difference: $${formatPrice(scrapeResult.price - product.shopifyPrice)}`;
                  
                  await sendTelegramNotification(user.telegramChatId, message);
                  
                  // Create notification record
                  await storage.createNotification({
                    productId: product.id,
                    message,
                    status: "sent"
                  });
                  
                  // Update the sentAt field (which is not part of insertNotificationSchema)
                  const [notification] = await storage.getPendingNotifications();
                  if (notification) {
                    await storage.updateNotification(notification.id, {
                      sentAt: new Date()
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Error scraping price for SKU ${record.sku}:`, error);
          }
        }
        
        processedCount++;
        
        // Update progress every 5 records for more frequent updates
        if (processedCount % 5 === 0) {
          await storage.updateCsvUpload(uploadId, {
            processedCount
          });
        }
      } catch (error) {
        console.error(`Error processing record for SKU ${record.sku}:`, error);
      }
    }
    
    // Update final status with detailed logs
    console.log(`CSV Upload ${uploadId} processing complete. Total records: ${records.length}, Processed: ${processedCount}, Updated: ${updatedProductCount}, New: ${newProductCount}`);
    await storage.updateCsvUpload(uploadId, {
      processedCount,
      status: "completed"
    });
  } catch (error) {
    console.error(`Error processing CSV upload ${uploadId}:`, error);
    
    // Update status to error
    await storage.updateCsvUpload(uploadId, {
      status: "error"
    });
  }
}

async function syncShopifyProducts(apiKey: string, apiSecret: string, storeUrl: string): Promise<void> {
  try {
    const products = await shopifyClient.getAllProducts(apiKey, apiSecret, storeUrl);
    
    for (const shopifyProduct of products) {
      try {
        // Check if product exists in our database
        const existingProduct = await storage.getProductBySku(shopifyProduct.sku);
        
        if (existingProduct) {
          // Update existing product
          await storage.updateProduct(existingProduct.id, {
            title: shopifyProduct.title,
            description: shopifyProduct.description,
            shopifyPrice: shopifyProduct.price,
            images: shopifyProduct.images,
            status: "active",
            vendor: shopifyProduct.vendor,
            productType: shopifyProduct.productType
          });
        } else {
          // Create new product
          await storage.createProduct({
            sku: shopifyProduct.sku,
            title: shopifyProduct.title,
            description: shopifyProduct.description,
            shopifyId: shopifyProduct.id,
            shopifyPrice: shopifyProduct.price,
            images: shopifyProduct.images,
            status: "active",
            vendor: shopifyProduct.vendor,
            productType: shopifyProduct.productType
          });
        }
      } catch (error) {
        console.error(`Error processing Shopify product ${shopifyProduct.sku}:`, error);
      }
    }
    
    console.log(`Synced ${products.length} products from Shopify`);
  } catch (error) {
    console.error("Error syncing Shopify products:", error);
  }
}

