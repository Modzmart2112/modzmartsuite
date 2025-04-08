import { storage } from './storage';
import { scrapePriceFromUrl } from './scraper';
import { sendTelegramNotification } from './telegram';
import { shopifyClient } from './shopify';
import { log } from './vite';

/**
 * Scheduler class for managing periodic tasks
 */
export class Scheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Start a job with a specified interval
   * @param name Job identifier
   * @param intervalMs Interval in milliseconds
   * @param job Function to execute
   */
  startJob(name: string, intervalMs: number, job: () => Promise<void>) {
    // Clear any existing job with the same name
    this.stopJob(name);
    
    // For the price check job, we want to run at midnight AEST
    if (name === 'daily-price-check') {
      // Calculate time until next midnight AEST
      const msUntilMidnightAEST = this.calculateMsUntilMidnightAEST();
      
      log(`Starting scheduled job: ${name} at midnight AEST (in ${Math.round(msUntilMidnightAEST/1000/60)} minutes)`, 'scheduler');
      
      // Don't run immediately, wait until the scheduled time
      const timer = setTimeout(() => {
        // Run at midnight
        log(`Running scheduled job: ${name} (midnight AEST triggered)`, 'scheduler');
        job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
        
        // Then set up the recurring daily interval
        const dailyTimer = setInterval(() => {
          log(`Running scheduled job: ${name} (daily midnight AEST)`, 'scheduler');
          job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
        }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
        
        this.timers.set(name, dailyTimer);
      }, msUntilMidnightAEST);
      
      this.timers.set(name, timer);
    } else {
      // For other jobs, use the standard interval approach
      log(`Starting scheduled job: ${name} (interval: ${intervalMs}ms)`, 'scheduler');
      
      // Execute job immediately
      job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
      
      // Schedule periodic execution
      const timer = setInterval(() => {
        log(`Running scheduled job: ${name}`, 'scheduler');
        job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
      }, intervalMs);
      
      this.timers.set(name, timer);
    }
  }
  
  /**
   * Calculate milliseconds until next midnight AEST (UTC+10)
   * @returns Milliseconds until midnight AEST
   */
  private calculateMsUntilMidnightAEST(): number {
    // Current time in UTC
    const now = new Date();
    
    // AEST is UTC+10
    const aestOffset = 10 * 60 * 60 * 1000; // 10 hours in milliseconds
    
    // Current time in AEST
    const aestNow = new Date(now.getTime() + aestOffset);
    
    // Next midnight in AEST
    const aestMidnight = new Date(aestNow);
    aestMidnight.setHours(0, 0, 0, 0);
    
    // If it's already past midnight AEST, set to next day
    if (aestNow > aestMidnight) {
      aestMidnight.setDate(aestMidnight.getDate() + 1);
    }
    
    // Calculate milliseconds until midnight AEST
    return aestMidnight.getTime() - aestNow.getTime();
  }
  
  /**
   * Stop a running job
   * @param name Job identifier
   */
  stopJob(name: string) {
    const timer = this.timers.get(name);
    if (timer) {
      // Clear both types of timers to be safe
      clearInterval(timer);
      clearTimeout(timer);
      this.timers.delete(name);
      log(`Stopped job: ${name}`, 'scheduler');
    }
  }
  
  /**
   * Stop all running jobs
   */
  stopAll() {
    for (const [name, timer] of this.timers.entries()) {
      // Clear both types of timers to be safe
      clearInterval(timer);
      clearTimeout(timer);
      log(`Stopped job: ${name}`, 'scheduler');
    }
    this.timers.clear();
  }
}

/**
 * Scheduled job that checks all products with supplier URLs for price discrepancies
 */
export async function checkAllPrices(): Promise<void> {
  try {
    // Get all active products that have supplier URLs
    const products = await storage.getProductsWithSupplierUrls();
    
    log(`Starting price check for ${products.length} products`, 'price-checker');
    
    // Initialize counters for reporting
    let checkedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process each product
    for (const product of products) {
      try {
        if (!product.supplierUrl) continue;
        
        // Scrape the current price using the same method as CSV processing
        log(`Checking price for ${product.sku} (${product.title})`, 'price-checker');
        
        // Use the same scraper that CSV processing uses to ensure consistency
        const result = await scrapePriceFromUrl(product.supplierUrl);
        
        if (result.price) {
          // Update the product with the new price
          const oldPrice = product.supplierPrice;
          const newPrice = result.price;
          
          // Only update if price has changed
          if (oldPrice !== newPrice) {
            // Update product in database
            await storage.updateProduct(product.id, {
              supplierPrice: newPrice,
              hasPriceDiscrepancy: Math.abs(newPrice - product.shopifyPrice) > 0.01,
              lastChecked: new Date()
            });
            
            // Create price history record
            await storage.createPriceHistory({
              productId: product.id,
              shopifyPrice: product.shopifyPrice,
              supplierPrice: newPrice
            });
            
            updatedCount++;
            
            // Send notification for price discrepancies
            if (Math.abs(newPrice - product.shopifyPrice) > 0.01) {
              // Create notification in database
              await storage.createNotification({
                productId: product.id,
                status: 'pending',
                message: `Price discrepancy detected for SKU: ${product.sku}, Shopify price: $${product.shopifyPrice.toFixed(2)}, Supplier price: $${newPrice.toFixed(2)}`
              });
              
              // Send Telegram notification if configured
              const user = await storage.getUser(1); // Using first user as default
              if (user && user.telegramChatId) {
                await sendTelegramNotification(
                  user.telegramChatId,
                  `🔔 *Price Discrepancy Alert*\n\nSKU: ${product.sku}\nProduct: ${product.title}\nOld price: $${oldPrice?.toFixed(2) || 'N/A'}\nNew price: $${newPrice.toFixed(2)}\nShopify price: $${product.shopifyPrice.toFixed(2)}`
                );
              }
            }
          } else {
            // Price hasn't changed, just update lastChecked
            await storage.updateProduct(product.id, {
              lastChecked: new Date()
            });
          }
        }
        
        checkedCount++;
      } catch (error) {
        errorCount++;
        log(`Error checking price for ${product.sku}: ${error}`, 'price-checker');
      }
      
      // Add a small delay between requests to avoid overwhelming supplier servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    log(`Price check complete: ${checkedCount} checked, ${updatedCount} updated, ${errorCount} errors`, 'price-checker');
    
    // Update stats
    const stats = await storage.getStats();
    if (stats) {
      await storage.updateStats({
        lastPriceCheck: new Date(),
        totalPriceChecks: (stats.totalPriceChecks || 0) + checkedCount,
        totalDiscrepanciesFound: (stats.totalDiscrepanciesFound || 0) + updatedCount
      });
    }
    
  } catch (error) {
    log(`Failed to complete price check: ${error}`, 'price-checker');
  }
}

/**
 * Automated job to sync products from Shopify
 * This job will run every hour to check for new or updated products in Shopify
 * 
 * NOTE: This function now uses the improved implementation for better progress tracking
 * and performance instead of the original implementation.
 */
export async function scheduledSyncShopifyProducts(): Promise<void> {
  try {
    // Call the improved implementation directly
    return await import('./improved-shopify-sync').then(module => module.improvedSyncShopifyProducts());
  } catch (error) {
    log(`Error in scheduled Shopify sync: ${error}`, "shopify-sync");
    
    // Update progress to error with completedAt date
    await storage.updateShopifySyncProgress({
      status: "error",
      completedAt: new Date(),
      message: `Sync failed with error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Create a singleton instance
export const scheduler = new Scheduler();