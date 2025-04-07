import { storage } from './storage';
import { scrapePriceFromUrl } from './scraper';
import { sendTelegramNotification } from './telegram';
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
  
  /**
   * Stop a running job
   * @param name Job identifier
   */
  stopJob(name: string) {
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
      log(`Stopped job: ${name}`, 'scheduler');
    }
  }
  
  /**
   * Stop all running jobs
   */
  stopAll() {
    for (const [name, timer] of this.timers.entries()) {
      clearInterval(timer);
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
        
        // Scrape the current price
        log(`Checking price for ${product.sku} (${product.title})`, 'price-checker');
        const result = await scrapePriceFromUrl(product.supplierUrl, product.sku);
        
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

// Create a singleton instance
export const scheduler = new Scheduler();