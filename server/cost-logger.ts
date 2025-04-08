/**
 * Cost Logger - a dedicated module to log Shopify cost price information to the database.
 * This is used by the UI to display cost price data in real-time during sync operations.
 */

import { log } from './vite';
import { storage } from './storage';

/**
 * Log a cost price event to the database for real-time UI display
 * @param sku Product SKU
 * @param price Cost price
 * @param message Message to log
 */
export async function logCostPrice(sku: string, price: number, message?: string): Promise<void> {
  try {
    // Get the default message if not provided
    const defaultMessage = `Got cost price for ${sku}: $${price.toFixed(2)}`;
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
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    log(`Error logging cost price for SKU ${sku}: ${error}`, 'shopify-api');
  }
}