/**
 * Cost Logger - a dedicated module to log Shopify cost price information to the database.
 * This is used by the UI to display cost price data in real-time during sync operations.
 */

import { log } from './vite';
import { storage } from './storage';

/**
 * Log a cost price event to the database for real-time UI display
 * Also updates the product's cost_price field in real-time
 * 
 * @param sku Product SKU
 * @param price Cost price
 * @param message Message to log
 * @param position Current product position (optional)
 * @param totalProducts Total product count (optional)
 */
export async function logCostPrice(
  sku: string, 
  price: number, 
  message?: string, 
  position?: number, 
  totalProducts?: number
): Promise<void> {
  try {
    // Get the current sync ID to tag the logs
    const syncProgress = await storage.getShopifySyncProgress();
    const currentSyncId = syncProgress?.id || 0;
    
    // Get the default message if not provided
    const defaultMessage = `Got cost price for ${sku}: $${price.toFixed(2)}${currentSyncId ? ` [SyncID: ${currentSyncId}]` : ''}`;
    const logMessage = message || defaultMessage;
    
    // Log to console
    log(logMessage, 'shopify-api');
    
    // Log to database with metadata
    await storage.createShopifyLog(
      logMessage,
      'info',
      {
        type: 'cost_price',
        sku,
        price,
        syncId: currentSyncId,
        position: position || syncProgress?.processedItems || 0,
        totalProducts: totalProducts || syncProgress?.totalItems || 0,
        timestamp: new Date().toISOString()
      }
    );
    
    // Update the cost_price field in the products table in real-time
    try {
      const product = await storage.getProductBySku(sku);
      if (product) {
        log(`Updating cost price for product ${sku} to $${price.toFixed(2)}`, 'shopify-api');
        await storage.updateProduct(product.id, {
          costPrice: price
        });
        
        // Direct SQL update removed for ESM compatibility
      }
    } catch (updateError) {
      log(`Error updating cost price for product ${sku}: ${updateError}`, 'shopify-api');
    }
  } catch (error) {
    log(`Error logging cost price for SKU ${sku}: ${error}`, 'shopify-api');
  }
}