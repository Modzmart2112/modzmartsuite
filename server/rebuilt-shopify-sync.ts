/**
 * COMPLETELY REBUILT Shopify Sync Implementation
 * 
 * This module implements a fresh approach with a clear 3-step process:
 * Step 1: Count total products (accurate unique product count)
 * Step 2: Process products with clear ETA
 * Step 3: Complete sync with clean termination
 * 
 * Key improvements:
 * - Uses direct Shopify count APIs for accurate product counts
 * - Processes in small batches with rate limiting
 * - Shows real-time cost price updates
 * - Provides accurate ETAs based on processing speed
 * - Groups variants by product for better progress tracking
 * - Clear status messages at each stage
 */

import { storage } from './storage';
import { shopifyClient } from './shopify';
import { logCostPrice } from './cost-logger';

// Configuration
const BATCH_SIZE = 25; // Process fewer products per batch for smoother updates
const BATCH_DELAY_MS = 750; // More delay between batches to prevent rate limiting
const MAX_RETRIES = 3; // Maximum retries for failed operations
const STATUS_UPDATE_INTERVAL = 5; // Update DB status every N products

// Logging helper
function log(message: string, category = 'shopify-sync'): void {
  console.log(`[${category}] ${message}`);
}

/**
 * Main entry point for the Shopify sync process
 * Follows a clear 3-step process with proper progress tracking
 */
export async function rebuildSyncShopifyProducts(): Promise<void> {
  // Start with clean state
  let syncProgress = await storage.initializeShopifySyncProgress();
  let startTime = Date.now();
  
  try {
    // Get API credentials
    const settings = await storage.getSettings();
    if (!settings?.shopifyApiKey || !settings?.shopifyApiSecret || !settings?.shopifyStoreUrl) {
      await storage.updateShopifySyncProgress({
        status: "failed",
        message: "Shopify API credentials are missing or incomplete",
        completedAt: new Date()
      });
      return;
    }
    
    const { shopifyApiKey: apiKey, shopifyApiSecret: apiSecret, shopifyStoreUrl: storeUrl } = settings;
    
    // STEP 1: Count products (accurate count of unique products, not variants)
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: "Step 1/3: Counting unique products in your Shopify store...",
      details: { step: 1, totalSteps: 3 }
    });
    
    const countResult = await countShopifyProducts(apiKey, apiSecret, storeUrl);
    
    if (!countResult.success) {
      throw new Error(`Product counting failed: ${countResult.error}`);
    }
    
    const { productCount, variantCount } = countResult;
    
    // Log count results
    log(`Step 1 complete: Found ${productCount} unique products and ${variantCount} total variants`);
    
    // Update progress with counts
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      totalItems: productCount, // Set to unique product count
      message: `Step 2/3: Processing ${productCount} unique products (${variantCount} variants)...`,
      details: { 
        step: 2, 
        totalSteps: 3,
        uniqueProductCount: productCount,
        variantCount,
        isEstimate: false
      }
    });
    
    // STEP 2: Process products with ETA
    const processingResult = await processProducts(apiKey, apiSecret, storeUrl, productCount, variantCount);
    
    // STEP 3: Complete sync with summary
    const totalTimeMs = Date.now() - startTime;
    const formattedTime = formatDuration(totalTimeMs);
    
    const completionMessage = `Step 3/3: Sync completed - ${processingResult.successCount} out of ${processingResult.processedCount} items processed successfully in ${formattedTime}`;
    
    // Update stats with sync time
    try {
      await storage.updateStats({
        lastShopifySync: new Date()
      });
    } catch (error) {
      log(`Error updating sync timestamp: ${error}`);
    }
    
    // Final update to mark completion
    await storage.updateShopifySyncProgress({
      status: "complete",
      completedAt: new Date(),
      processedItems: processingResult.processedCount,
      successItems: processingResult.successCount,
      failedItems: processingResult.failedCount,
      message: completionMessage,
      details: {
        step: 3,
        totalSteps: 3,
        uniqueProductCount: productCount,
        variantCount: variantCount,
        processingTimeMs: totalTimeMs,
        averageTimePerProduct: processingResult.processedCount > 0 
          ? totalTimeMs / processingResult.processedCount 
          : 0,
        isEstimate: false
      }
    });
    
    log(`Sync process complete in ${formattedTime}`);
    
  } catch (error) {
    // Handle errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Sync process failed: ${errorMessage}`, 'shopify-sync-error');
    
    // Update progress to failed state
    await storage.updateShopifySyncProgress({
      status: "failed",
      message: `Sync failed: ${errorMessage}`,
      completedAt: new Date(),
      details: {
        error: errorMessage,
        processingTimeMs: Date.now() - startTime
      }
    });
  }
}

/**
 * Step 1: Count products in Shopify store
 * Uses direct count endpoints for accurate counts
 */
async function countShopifyProducts(
  apiKey: string, 
  apiSecret: string, 
  storeUrl: string
): Promise<{
  success: boolean;
  productCount: number;
  variantCount: number;
  error?: string;
}> {
  try {
    log(`Requesting product count from Shopify...`);
    
    // Get unique product count (not variants)
    const productCount = await shopifyClient.getProductCount(apiKey, apiSecret, storeUrl);
    
    // Get variant count for progress calculations
    const variantCount = await shopifyClient.getVariantCount(apiKey, apiSecret, storeUrl);
    
    log(`Count results - Unique products: ${productCount}, Variants: ${variantCount}`);
    
    return {
      success: true,
      productCount,
      variantCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error counting products: ${errorMessage}`, 'shopify-sync-error');
    
    return {
      success: false,
      productCount: 0,
      variantCount: 0,
      error: errorMessage
    };
  }
}

/**
 * Step 2: Process all products with batching and real-time progress updates
 */
async function processProducts(
  apiKey: string,
  apiSecret: string,
  storeUrl: string,
  uniqueProductCount: number,
  totalVariantCount: number
): Promise<{
  processedCount: number;
  successCount: number;
  failedCount: number;
}> {
  const startTime = Date.now();
  
  // Initialize counters
  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  
  try {
    // Get all products from Shopify
    log(`Retrieving all products from Shopify...`);
    const allProducts = await shopifyClient.getAllProducts(apiKey, apiSecret, storeUrl);
    
    // Group variants by product ID for better reporting
    const productGroups = new Map<string, any[]>();
    
    log(`Organizing ${allProducts.length} variants into product groups...`);
    
    for (const product of allProducts) {
      if (!product.productId) continue;
      
      const productId = product.productId.toString();
      if (!productGroups.has(productId)) {
        productGroups.set(productId, []);
      }
      
      const variants = productGroups.get(productId);
      if (variants) {
        variants.push(product);
      }
    }
    
    log(`Organized products into ${productGroups.size} unique product groups`);
    
    // Process in batches
    let currentBatch: any[] = [];
    let processedProducts = 0;
    
    const productIds = Array.from(productGroups.keys());
    
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const variants = productGroups.get(productId) || [];
      
      // Add all variants to current batch
      currentBatch.push(...variants);
      processedProducts++;
      
      // Process batch when full or at the end
      const isLastProduct = i === productIds.length - 1;
      const isBatchFull = currentBatch.length >= BATCH_SIZE;
      
      if (isBatchFull || isLastProduct) {
        // Process current batch
        const batchResult = await processBatch(currentBatch);
        
        // Update counters
        processedCount += batchResult.processed;
        successCount += batchResult.success;
        failedCount += batchResult.failed;
        
        // Update progress and ETA
        const elapsedMs = Date.now() - startTime;
        const progressPercent = Math.round((processedProducts / uniqueProductCount) * 100);
        
        // Calculate ETA
        const msPerProduct = processedProducts > 0 ? elapsedMs / processedProducts : 0;
        const remainingProducts = uniqueProductCount - processedProducts;
        const estimatedRemainingMs = msPerProduct * remainingProducts;
        const estimatedCompletionTime = new Date(Date.now() + estimatedRemainingMs);
        
        // Update progress in database
        await storage.updateShopifySyncProgress({
          processedItems: processedCount,
          successItems: successCount,
          failedItems: failedCount,
          message: `Step 2/3: Processing products (${progressPercent}% complete, ${formatDuration(estimatedRemainingMs)} remaining)`,
          details: {
            step: 2,
            totalSteps: 3,
            uniqueProductCount,
            processedUniqueProducts: processedProducts,
            percentage: progressPercent,
            currentSpeed: msPerProduct > 0 ? Math.round(60000 / msPerProduct) : 0, // products per minute
            estimatedCompletionTime: estimatedCompletionTime.toISOString(),
            elapsedTime: elapsedMs,
            remainingTime: estimatedRemainingMs,
            isEstimate: false
          }
        });
        
        log(`Progress: ${processedProducts}/${uniqueProductCount} products (${progressPercent}%), ETA: ${formatDuration(estimatedRemainingMs)}`);
        
        // Reset batch and pause before next one
        currentBatch = [];
        
        if (!isLastProduct) {
          // Delay before next batch to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    }
    
    return { processedCount, successCount, failedCount };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing products: ${errorMessage}`, 'shopify-sync-error');
    
    return { processedCount, successCount, failedCount };
  }
}

/**
 * Process a batch of product variants
 */
async function processBatch(products: any[]): Promise<{ 
  processed: number; 
  success: number; 
  failed: number; 
}> {
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  for (const product of products) {
    try {
      processed++;
      
      // Skip products without SKUs
      if (!product.sku) {
        log(`Skipping product without SKU: ${product.title || 'Unknown'}`);
        failed++;
        continue;
      }
      
      // Get existing product from database
      const existingProduct = await storage.getProductBySku(product.sku);
      
      // Prepare data for database
      const productData = {
        sku: product.sku,
        title: product.title || "",
        description: product.description || null,
        shopifyId: product.productId || null,
        shopifyPrice: product.price || 0,
        vendor: product.vendor || "",
        productType: product.productType || "",
        status: "active",
        costPrice: product.cost || null,
        images: Array.isArray(product.images) ? product.images : []
      };
      
      // Update or create product
      if (existingProduct) {
        await storage.updateProduct(existingProduct.id, productData);
      } else {
        await storage.createProduct(productData);
      }
      
      // Add cost price to log feed in real-time
      if (product.cost) {
        await logCostPrice(product.sku, product.cost, `Updated from Shopify sync`);
      }
      
      success++;
    } catch (error) {
      const sku = product?.sku || 'unknown';
      log(`Error processing product ${sku}: ${error}`, 'shopify-sync-error');
      failed++;
    }
  }
  
  return { processed, success, failed };
}

/**
 * Format milliseconds into human-readable duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}