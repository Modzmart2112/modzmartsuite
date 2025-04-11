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
  // Track which jobs are scheduled but not actively running yet
  private scheduledJobs: Map<string, { nextRun: Date, isActive: boolean }> = new Map();
  
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
      
      // Calculate the next run time 
      const nextRunDate = new Date(Date.now() + msUntilMidnightAEST);
      
      log(`Starting scheduled job: ${name} at midnight AEST (in ${Math.round(msUntilMidnightAEST/1000/60)} minutes)`, 'scheduler');
      
      // Add to scheduled jobs map with isActive=false since it's not running yet
      this.scheduledJobs.set(name, { 
        nextRun: nextRunDate, 
        isActive: false 
      });
      
      // Don't run immediately, wait until the scheduled time
      const timer = setTimeout(() => {
        // Run at midnight
        log(`Running scheduled job: ${name} (midnight AEST triggered)`, 'scheduler');
        
        // Update the status to active
        this.scheduledJobs.set(name, { 
          nextRun: new Date(nextRunDate.getTime() + 24 * 60 * 60 * 1000), // Next run is tomorrow
          isActive: true 
        });
        
        job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
        
        // Then set up the recurring daily interval
        const dailyTimer = setInterval(() => {
          // Update the next run time when the job runs
          const nextMidnight = new Date();
          nextMidnight.setDate(nextMidnight.getDate() + 1);
          nextMidnight.setHours(0, 0, 0, 0);
          
          this.scheduledJobs.set(name, { 
            nextRun: nextMidnight,
            isActive: true 
          });
          
          log(`Running scheduled job: ${name} (daily midnight AEST)`, 'scheduler');
          job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
        }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
        
        this.timers.set(name, dailyTimer);
      }, msUntilMidnightAEST);
      
      this.timers.set(name, timer);
    } else {
      // For other jobs, use the standard interval approach
      log(`Starting scheduled job: ${name} (interval: ${intervalMs}ms)`, 'scheduler');
      
      // Mark job as active immediately
      this.scheduledJobs.set(name, { 
        nextRun: new Date(), // It's running right now
        isActive: true 
      });
      
      // Execute job immediately
      job().catch(err => log(`Error in job ${name}: ${err}`, 'scheduler'));
      
      // Schedule periodic execution
      const timer = setInterval(() => {
        // Update the next run time
        const nextRun = new Date(Date.now() + intervalMs);
        this.scheduledJobs.set(name, { 
          nextRun,
          isActive: true 
        });
        
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
      
      // Also remove from scheduled jobs
      this.scheduledJobs.delete(name);
      
      log(`Stopped job: ${name}`, 'scheduler');
    }
  }
  
  /**
   * Stop all running jobs
   */
  stopAll() {
    // Using Array.from to avoid iterator issues
    Array.from(this.timers.entries()).forEach(([name, timer]) => {
      // Clear both types of timers to be safe
      clearInterval(timer);
      clearTimeout(timer);
      log(`Stopped job: ${name}`, 'scheduler');
    });
    
    this.timers.clear();
    this.scheduledJobs.clear();
  }
  
  /**
   * Get job status information
   * @returns Object with job statuses
   */
  getJobStatus() {
    const now = new Date();
    const result: {
      activeJobs: string[];
      scheduledJobs: { [key: string]: { nextRun: string, isActive: boolean } };
      runningJobs: string[];
    } = {
      activeJobs: Array.from(this.timers.keys()),
      scheduledJobs: {},
      runningJobs: []
    };
    
    // Add details about scheduled jobs
    this.scheduledJobs.forEach((status, name) => {
      result.scheduledJobs[name] = {
        nextRun: status.nextRun.toISOString(),
        isActive: status.isActive
      };
      
      if (status.isActive) {
        result.runningJobs.push(name);
      }
    });
    
    return result;
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
 * NOTE: This function now uses the completely rebuilt implementation 
 * with the correct 3-step process:
 * 1. Count products (accurate count of unique products)
 * 2. Process products with clear ETA
 * 3. Complete sync with clean termination
 */
/**
 * Automated job to sync products from Shopify
 * This job will run every hour to check for new or updated products in Shopify
 * 
 * NOTE: This function now uses the completely enhanced implementation 
 * with the correct 3-step process:
 * 1. Count products (accurate count of unique products)
 * 2. Process products with clear ETA
 * 3. Complete sync with clean termination
 */
export async function scheduledSyncShopifyProducts(): Promise<void> {
  try {
    // Use the new enhanced implementation with modernized UI support
    return await import('./enhanced-shopify-sync').then(module => module.enhancedSyncShopifyProducts());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error in scheduled Shopify sync: ${errorMessage}`, "shopify-sync-error");
    
    // Update progress to failed state with completion time and detailed error info
    await storage.updateShopifySyncProgress({
      status: "failed",
      completedAt: new Date(),
      message: `Sync failed with error: ${errorMessage}`,
      details: {
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        step: "unknown",
        timeOfFailure: new Date().toISOString()
      }
    });
  }
}

// The SIL-RP-016 price fix job has been removed as it's no longer needed

export const scheduler = new Scheduler();

/**
 * Setup all schedulers for the application
 */
export function setupSchedulers() {
  // Skip schedulers in production deployment
  if (process.env.DISABLE_SCHEDULERS === 'true') {
    log('Schedulers disabled via environment variable', 'scheduler');
    return scheduler;
  }
  
  // Start the daily price check job (will run at midnight AEST)
  scheduler.startJob('daily-price-check', 24 * 60 * 60 * 1000, checkAllPrices);
  
  // Start Shopify sync job (run every hour)
  scheduler.startJob('shopify-sync', 60 * 60 * 1000, scheduledSyncShopifyProducts);
  
  log('Schedulers setup complete', 'scheduler');
  
  return scheduler;
}