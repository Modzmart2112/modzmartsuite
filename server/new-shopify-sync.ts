/**
 * New Shopify Sync Implementation
 * 
 * This module provides a completely redesigned approach to syncing products from Shopify
 * with a focus on:
 * 1. Accurate counting of unique products (not variants)
 * 2. Clear progress reporting with proper ETA
 * 3. Efficient batch processing with rate limiting
 * 4. Robust error handling and recovery
 * 5. Clear 3-step process flow
 * 
 * The sync process follows these distinct steps:
 * Step 1: Count unique products in Shopify store
 * Step 2: Process products with accurate ETA
 * Step 3: Finalize sync with summary
 */

import { shopifyClient } from './shopify';
import { storage } from './storage';
import { log } from './vite';
import { logCostPrice } from './cost-logger';

// Constants for processing configuration
const BATCH_SIZE = 50;               // Number of products to process in each batch
const BATCH_DELAY_MS = 1000;         // Delay between batches to avoid rate limits
const AVERAGE_ITEM_PROCESS_TIME = 500; // Estimated processing time per item in milliseconds

/**
 * Main sync function - completely redesigned for accurate product counting
 */
export async function newSyncShopifyProducts(): Promise<void> {
  try {
    // Initialize or reset the sync progress
    let syncProgress = await storage.initializeShopifySyncProgress();
    
    // Update progress to indicate we're starting
    syncProgress = await storage.updateShopifySyncProgress({
      status: "in-progress",
      totalItems: null,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      message: "Initializing Shopify sync..."
    });
    
    // Get Shopify credentials
    const user = await storage.getUser(1);
    
    if (!user || !user.shopifyApiKey || !user.shopifyApiSecret || !user.shopifyStoreUrl) {
      log("Shopify credentials not found", "shopify-sync");
      await storage.updateShopifySyncProgress({
        status: "error",
        completedAt: new Date(),
        message: "Shopify credentials not configured"
      });
      return;
    }
    
    // Clean and validate the store URL
    let storeUrl = user.shopifyStoreUrl;
    if (!storeUrl.startsWith('http://') && !storeUrl.startsWith('https://')) {
      storeUrl = 'https://' + storeUrl;
    }
    
    try {
      new URL(storeUrl);
    } catch (error) {
      await storage.updateShopifySyncProgress({
        status: "error",
        completedAt: new Date(),
        message: "Invalid Shopify store URL format"
      });
      return;
    }
    
    //================================================
    // STEP 1: COUNT PRODUCTS (not variants)
    //================================================
    
    log("STEP 1: Counting unique products in Shopify store", "shopify-sync");
    await storage.updateShopifySyncProgress({
      message: "Counting products in your Shopify store..."
    });
    
    // Get product count directly from Shopify using Admin API
    const countResult = await getShopifyUniqueProductCount(
      user.shopifyApiKey,
      user.shopifyApiSecret,
      storeUrl
    );
    
    if (!countResult.success) {
      await storage.updateShopifySyncProgress({
        status: "error",
        completedAt: new Date(),
        message: `Failed to count products: ${countResult.error}`
      });
      return;
    }
    
    const { uniqueProductCount, uniqueVariantCount } = countResult;
    log(`Found ${uniqueProductCount} unique products with ${uniqueVariantCount} total variants`, "shopify-sync");
    
    if (uniqueProductCount === 0) {
      await storage.updateShopifySyncProgress({
        status: "complete",
        completedAt: new Date(),
        message: "No products found in Shopify store"
      });
      return;
    }
    
    // Calculate estimated completion time
    const estimatedTotalTimeMs = uniqueVariantCount * AVERAGE_ITEM_PROCESS_TIME;
    const estimatedCompletionTime = new Date(Date.now() + estimatedTotalTimeMs);
    
    await storage.updateShopifySyncProgress({
      totalItems: uniqueProductCount,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      message: `Ready to process ${uniqueProductCount} unique products`,
      details: {
        uniqueProductCount,
        totalVariantCount: uniqueVariantCount,
        estimatedCompletionTime: estimatedCompletionTime.toISOString(),
        percentage: 0,
        isEstimate: false
      }
    });
    
    //================================================
    // STEP 2: PROCESS PRODUCTS IN BATCHES
    //================================================
    
    log("STEP 2: Processing products in batches", "shopify-sync");
    await storage.updateShopifySyncProgress({
      message: "Processing products..."
    });
    
    // Start processing with progress tracking
    const result = await processAllShopifyProducts(
      user.shopifyApiKey,
      user.shopifyApiSecret,
      storeUrl,
      uniqueProductCount,
      uniqueVariantCount
    );
    
    //================================================
    // STEP 3: FINALIZE SYNC
    //================================================
    
    log("STEP 3: Finalizing sync", "shopify-sync");
    
    // Format time for display
    const formattedTime = formatTime(result.totalTimeMs);
    const completionMessage = `Sync completed: ${result.successCount} products processed, ${result.failedCount} failed in ${formattedTime}`;
    
    log(completionMessage, "shopify-sync");
    
    // Update final status
    await storage.updateShopifySyncProgress({
      status: "complete",
      completedAt: new Date(),
      processedItems: result.processedCount,
      successItems: result.successCount,
      failedItems: result.failedCount,
      message: completionMessage,
      details: {
        uniqueProductCount,
        totalTime: result.totalTimeMs,
        percentage: 100,
        isEstimate: false
      }
    });
    
    // Update global stats
    await storage.updateStats({
      lastShopifySync: new Date()
    });
    
  } catch (error) {
    log(`Unhandled error in Shopify sync: ${error}`, "shopify-sync");
    
    await storage.updateShopifySyncProgress({
      status: "error",
      completedAt: new Date(),
      message: `Sync failed with error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Get a count of unique products (not variants) from Shopify
 * This uses the count endpoint which is very fast and lightweight
 */
async function getShopifyUniqueProductCount(
  apiKey: string,
  apiSecret: string,
  storeUrl: string
): Promise<{ 
  success: boolean; 
  uniqueProductCount: number; 
  uniqueVariantCount: number;
  error?: string 
}> {
  try {
    // First get the count of unique products (not variants) using the direct Shopify count endpoint
    const productCount = await shopifyClient.getProductCount(apiKey, apiSecret, storeUrl);
    
    // Also get the count of variants for accurate progress calculation
    const variantCount = await shopifyClient.getVariantCount(apiKey, apiSecret, storeUrl);
    
    log(`Shopify product count: ${productCount} unique products, ${variantCount} variants`, "shopify-sync");
    
    return {
      success: true,
      uniqueProductCount: productCount,
      uniqueVariantCount: variantCount || productCount // Fallback to product count if variant count fails
    };
  } catch (error) {
    log(`Error getting product count: ${error}`, "shopify-sync");
    return {
      success: false,
      uniqueProductCount: 0,
      uniqueVariantCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Process all Shopify products with batching and progress tracking
 */
async function processAllShopifyProducts(
  apiKey: string,
  apiSecret: string,
  storeUrl: string,
  uniqueProductCount: number,
  uniqueVariantCount: number
): Promise<{
  processedCount: number;
  successCount: number;
  failedCount: number;
  totalTimeMs: number;
}> {
  // Initialize counters and timing
  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  const startTime = Date.now();
  
  try {
    // Get all products from Shopify - this returns variants
    const allProducts = await shopifyClient.getAllProducts(apiKey, apiSecret, storeUrl);
    
    // Group variants by product ID for better reporting
    const productGroups = new Map<string, any[]>();
    
    for (const product of allProducts) {
      if (!product.productId) continue;
      
      const productId = product.productId.toString();
      if (!productGroups.has(productId)) {
        productGroups.set(productId, []);
      }
      
      productGroups.get(productId)?.push(product);
    }
    
    // Process in batches for better performance
    let currentBatch: any[] = [];
    let processedProducts = 0; // Count of unique products processed
    
    for (const [productId, variants] of productGroups) {
      // Add all variants of this product to the current batch
      currentBatch.push(...variants);
      processedProducts++;
      
      // Process batch when it reaches the batch size or we're at the last product
      if (currentBatch.length >= BATCH_SIZE || processedProducts === productGroups.size) {
        // Process this batch
        const batchResults = await processBatch(currentBatch);
        
        // Update counters
        processedCount += batchResults.processed;
        successCount += batchResults.success;
        failedCount += batchResults.failed;
        
        // Update progress
        const elapsedTimeMs = Date.now() - startTime;
        const remainingProducts = uniqueProductCount - processedProducts;
        const estimatedRemainingTimeMs = remainingProducts * (elapsedTimeMs / processedProducts);
        const estimatedCompletionTime = new Date(Date.now() + estimatedRemainingTimeMs);
        const percentageComplete = Math.round((processedProducts / uniqueProductCount) * 100);
        
        await storage.updateShopifySyncProgress({
          processedItems: processedCount,
          successItems: successCount,
          failedItems: failedCount,
          message: `Processing products: ${processedCount} items processed so far`,
          details: {
            uniqueProductCount,
            processedUniqueProducts: processedProducts,
            estimatedCompletionTime: estimatedCompletionTime.toISOString(),
            percentage: percentageComplete,
            isEstimate: false,
            elapsedTime: elapsedTimeMs
          }
        });
        
        // Log progress
        log(`Progress: ${processedProducts}/${uniqueProductCount} products (${percentageComplete}%)`, "shopify-sync");
        
        // Clear batch and delay before next batch
        currentBatch = [];
        if (processedProducts < productGroups.size) {
          log(`Pausing for ${BATCH_DELAY_MS}ms before next batch...`, "shopify-sync");
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    }
    
    return {
      processedCount,
      successCount,
      failedCount,
      totalTimeMs: Date.now() - startTime
    };
  } catch (error) {
    log(`Error in processAllShopifyProducts: ${error}`, "shopify-sync");
    return {
      processedCount,
      successCount,
      failedCount,
      totalTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Process a batch of products
 */
async function processBatch(products: any[]): Promise<{ processed: number; success: number; failed: number }> {
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  for (const shopifyProduct of products) {
    try {
      processed++;
      
      // Skip products without SKUs
      if (!shopifyProduct.sku) {
        log(`Skipping product without SKU: ${shopifyProduct.title}`, "shopify-sync");
        failed++;
        continue;
      }
      
      // Look for existing product in database
      const existingProduct = await storage.getProductBySku(shopifyProduct.sku);
      
      // Prepare product data
      const productData = {
        sku: shopifyProduct.sku,
        title: shopifyProduct.title || "",
        shopifyId: shopifyProduct.productId || null,
        shopifyPrice: shopifyProduct.price || 0,
        vendor: shopifyProduct.vendor || "",
        status: "active",
        productType: shopifyProduct.productType || "",
        costPrice: shopifyProduct.cost || null,
        images: Array.isArray(shopifyProduct.images) ? shopifyProduct.images : []
      };
      
      // Update or create product
      if (existingProduct) {
        log(`Updating product ${shopifyProduct.sku}`, "shopify-sync");
        await storage.updateProduct(existingProduct.id, productData);
      } else {
        log(`Creating new product ${shopifyProduct.sku}`, "shopify-sync");
        await storage.createProduct(productData);
      }
      
      // Log cost price if available
      if (shopifyProduct.cost) {
        await logCostPrice(shopifyProduct.sku, shopifyProduct.cost);
      }
      
      success++;
    } catch (error) {
      log(`Error processing product ${shopifyProduct?.sku || 'unknown'}: ${error}`, "shopify-sync");
      failed++;
    }
  }
  
  return { processed, success, failed };
}

/**
 * Format milliseconds into a human-readable time string
 */
function formatTime(ms: number): string {
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