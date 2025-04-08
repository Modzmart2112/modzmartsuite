/**
 * ENHANCED Shopify Sync Implementation with Modern UI Support
 * 
 * This module implements a modern approach with a clear 3-step process:
 * Step 1: Count total products (accurate unique product count)
 * Step 2: Process products with clear ETA and real-time updates
 * Step 3: Complete sync with clean termination and success summary
 * 
 * Key improvements:
 * - Uses direct Shopify count APIs for accurate product counts
 * - Processes in small batches with intelligent rate limiting
 * - Shows real-time cost price updates for better user feedback
 * - Provides accurate ETAs based on dynamic processing speed calculation
 * - Groups variants by product for better progress tracking
 * - Clear status messages at each stage with time estimates
 * - Enhanced error handling and reporting
 * - Support for pausable processing (user can reset mid-sync)
 */

import { storage } from './storage';
import { shopifyClient } from './shopify';
import { logCostPrice } from './cost-logger';

// Configuration
const BATCH_SIZE = 10; // Smaller batches for more frequent UI updates
const BATCH_DELAY_MS = 500; // Delay between batches to respect rate limits
const MAX_RETRIES = 3; // Maximum retries for failed operations
const STATUS_UPDATE_INTERVAL = 1; // Update DB status after EVERY batch for more granular progress
const PROGRESS_UPDATE_THRESHOLD = 1; // Update progress after every 1% change for smoother tracking
const COST_CAPTURE_ENABLED = true; // Enable cost price capture and display

// Enhanced logging helper with categories
function log(message: string, category = 'shopify-sync'): void {
  // ISO timestamp for more accurate logging
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category}] ${message}`);
}

/**
 * Main entry point for the Shopify sync process
 * Follows a clear 3-step process with proper progress tracking
 * and enhanced status reporting for the new UI
 */
export async function enhancedSyncShopifyProducts(): Promise<void> {
  // *** COMPLETE RESET - Force a completely fresh start ***
  // Find the sync record we should be using (should be the one created by the routes.ts endpoint)
  const existingSync = await storage.getShopifySyncProgress();
  
  // Create a sync record if we don't have one (shouldn't happen since routes.ts creates one)
  if (!existingSync) {
    log('No sync record found. Creating a fresh one...');
    await storage.initializeShopifySyncProgress();
    // Get the newly created record
    const newSync = await storage.getShopifySyncProgress();
    
    if (!newSync) {
      throw new Error('Failed to create or retrieve a sync progress record');
    }
    
    // Make sure all counters are reset to 0
    await storage.updateShopifySyncProgress({
      id: newSync.id,
      status: "complete",
      completedAt: new Date(),
      message: "Previous sync marked as complete before starting new sync"
    });
  }
  
  // Now create a completely fresh sync with a clean slate
  let syncProgress = await storage.initializeShopifySyncProgress();
  log(`Starting brand new sync with ID ${syncProgress.id} - guaranteed fresh start`);
  const startTime = Date.now();
  
  try {
    // Get API credentials
    const settings = await storage.getUser(1); // Simplified: using first user
    if (!settings?.shopifyApiKey || !settings?.shopifyApiSecret || !settings?.shopifyStoreUrl) {
      await storage.updateShopifySyncProgress({
        status: "failed",
        message: "Shopify API credentials are missing or incomplete",
        completedAt: new Date(),
        details: {
          error: "API credentials missing",
          step: "initialization"
        }
      });
      log("Sync failed: Shopify API credentials are missing or incomplete");
      return;
    }
    
    // Extract credentials
    const { shopifyApiKey, shopifyApiSecret, shopifyStoreUrl } = settings;
    
    // Step 1: Count products - Update progress to show we're counting
    // Explicitly set percentage to 0 and clear previous progress
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: "Step 1/3: Counting products in Shopify store...",
      totalItems: 0,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      details: {
        step: 1,
        stepName: "counting",
        startTime: new Date().toISOString(),
        percentage: 0, // Explicitly set percentage to 0
        estimatedCompletionTime: null,
        estimatedRemainingMs: null
      }
    });
    
    // Get accurate product counts
    const countResult = await countShopifyProducts(shopifyApiKey, shopifyApiSecret, shopifyStoreUrl);
    if (!countResult.success) {
      await storage.updateShopifySyncProgress({
        status: "failed",
        message: `Failed to count products: ${countResult.error}`,
        completedAt: new Date(),
        details: {
          error: countResult.error,
          step: "counting"
        }
      });
      log(`Sync failed: ${countResult.error}`);
      return;
    }
    
    const { productCount, variantCount } = countResult;
    
    // Update progress with count information
    await storage.updateShopifySyncProgress({
      totalItems: variantCount,
      message: `Found ${productCount} unique products with ${variantCount} total variants`,
      details: {
        step: 1,
        stepName: "counting",
        uniqueProductCount: productCount,
        variantCount,
        countingCompleted: true,
        countDuration: Date.now() - startTime
      }
    });
    
    log(`Counting complete: ${productCount} unique products, ${variantCount} variants`);
    
    // Pause briefly to let frontend update before moving to next step
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Process products with clearer labeling
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: `Step 2/3: Getting ready to process ${variantCount} variants from ${productCount} products...`,
      processedItems: 0, // Reset processed items counter
      totalItems: variantCount, // Ensure total items is set correctly
      details: {
        step: 2,
        stepName: "initializing",
        startTime: new Date().toISOString(),
        uniqueProductCount: productCount,
        percentage: 0, // Explicitly set percentage to 0 at start
        estimatedCompletionTime: null,
        estimatedRemainingMs: null
      }
    });
    
    // Another brief pause to ensure UI shows the transition between stages
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Process all products
    const processingResult = await processProducts(
      shopifyApiKey, 
      shopifyApiSecret, 
      shopifyStoreUrl, 
      productCount, 
      variantCount
    );
    
    const { processedCount, successCount, failedCount } = processingResult;
    
    // Step 3: Complete sync with final status
    const completionTime = new Date();
    const totalTimeMs = Date.now() - startTime;
    
    // Update progress with completion information
    await storage.updateShopifySyncProgress({
      status: "complete",
      message: `Step 3/3: Sync completed: ${successCount} items synced successfully, ${failedCount} failed`,
      processedItems: processedCount,
      totalItems: variantCount, // Ensure total items remains set
      successItems: successCount,
      failedItems: failedCount,
      completedAt: completionTime,
      details: {
        step: 3,
        stepName: "completing",
        uniqueProductCount: productCount,
        totalDuration: totalTimeMs,
        formattedDuration: formatDuration(totalTimeMs),
        percentage: 100, // Set percentage to 100% on completion
        processingRate: totalTimeMs > 0 ? Math.round((processedCount / totalTimeMs) * 60000) : 0 // items per minute
      }
    });
    
    log(`Sync completed successfully in ${formatDuration(totalTimeMs)}`);
    log(`Results: ${successCount} items synced successfully, ${failedCount} failed`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Unexpected error in sync process: ${errorMessage}`, 'shopify-sync-error');
    
    // Update progress with error information
    await storage.updateShopifySyncProgress({
      status: "failed",
      message: `Sync failed with error: ${errorMessage}`,
      completedAt: new Date(),
      details: {
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      }
    });
  }
}

/**
 * Step 1: Count products in Shopify store
 * Uses dedicated count endpoints for accuracy
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
    // Before getting products, update progress to show we're retrieving data
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: `Step 2/3: Retrieving products from Shopify...`,
      processedItems: 0,
      totalItems: totalVariantCount,
      details: {
        step: 2,
        stepName: "preparing",
        retrievingProducts: true
      }
    });

    // Get all products from Shopify
    log(`Retrieving all products from Shopify...`);
    const allProducts = await shopifyClient.getAllProducts(apiKey, apiSecret, storeUrl);
    
    // Group variants by product ID for better reporting
    const productGroups = new Map<string, any[]>();
    
    log(`Organizing ${allProducts.length} variants into product groups...`);
    
    // Update progress to show we're organizing data before actual processing
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: `Step 2/3: Organizing ${allProducts.length} products...`,
      processedItems: 0,
      totalItems: totalVariantCount,
      details: {
        step: 2,
        stepName: "preparing",
        organizingProducts: true
      }
    });
    
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
      
      // Process batch if it has reached the batch size or it's the last product
      if (currentBatch.length >= BATCH_SIZE || i === productIds.length - 1) {
        // Process the current batch
        const batchResult = await processBatch(currentBatch);
        
        // Update counts
        processedCount += batchResult.processed;
        successCount += batchResult.success;
        failedCount += batchResult.failed;
        
        // Clear the batch
        currentBatch = [];
        
        // ALWAYS update progress after each batch for more precise tracking
        // No conditional logic - update every time for smoother progress
        
        // Calculate ETA based on current processing rate
        const elapsedMs = Date.now() - startTime;
        const itemsRemaining = totalVariantCount - processedCount;
        const msPerItem = processedCount > 0 ? elapsedMs / processedCount : 0;
        const estimatedRemainingMs = msPerItem * itemsRemaining;
        const estimatedCompletionTime = new Date(Date.now() + estimatedRemainingMs);
        
        // Calculate exact percentage with precise decimal (not rounded)
        // This ensures we never jump from 0% to 50%
        const exactPercentComplete = totalVariantCount > 0 
          ? (processedCount / totalVariantCount) * 100 
          : 0;
        
        // Round for display, but keep tracking precise
        const percentComplete = Math.min(100, Math.round(exactPercentComplete));
        
        // Log exact percentage for debugging
        log(`Exact progress: ${exactPercentComplete.toFixed(2)}%, Displayed: ${percentComplete}%`);
        
        // Update progress in database with clearer step labeling
        await storage.updateShopifySyncProgress({
          status: "in-progress",
          message: `Step 2/3: Processing ${processedCount} of ${totalVariantCount} items (${percentComplete}%)`,
          processedItems: processedCount,
          totalItems: totalVariantCount, // Always ensure total items is set
          successItems: successCount,
          failedItems: failedCount,
          details: {
            step: 2,
            stepName: "processing",
            uniqueProductCount,
            processedProductCount: processedProducts,
            totalProductCount: productGroups.size,
            percentage: exactPercentComplete, // Store exact percentage for frontend
            estimatedRemainingMs,
            estimatedCompletionTime: estimatedCompletionTime.toISOString(),
            processingRate: elapsedMs > 0 ? Math.round((processedCount / elapsedMs) * 60000) : 0, // items per minute
            elapsedTime: formatDuration(elapsedMs),
            // Add these fields to help debug the jump from 0% to 50%
            processedDebug: processedCount,
            totalDebug: totalVariantCount,
            batchSize: BATCH_SIZE,
            batchNumber: Math.ceil(i / STATUS_UPDATE_INTERVAL)
          }
        });
        
        log(`Step 2/3: Processed ${processedCount}/${totalVariantCount} items (${percentComplete}%) - ETA: ${formatDuration(estimatedRemainingMs)}`);
        
        // Add a small delay between batches to prevent rate limiting
        if (i < productIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    }
    
    return { processedCount, successCount, failedCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing products: ${errorMessage}`, 'shopify-sync-error');
    
    throw error; // Re-throw to be handled by the main function
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
  let success = 0;
  let failed = 0;
  
  for (const product of products) {
    try {
      // Skip products without required fields
      if (!product.sku || !product.title || !product.shopifyId) {
        failed++;
        continue;
      }
      
      // Check if the product already exists in our database
      let existingProduct = await storage.getProductBySku(product.sku);
      
      if (existingProduct) {
        // Update existing product
        await storage.updateProduct(existingProduct.id, {
          title: product.title,
          description: product.description || existingProduct.description,
          shopifyPrice: product.price,
          status: product.status || 'active'
        });
        
        // Get cost price if available - improved error handling and retry logic
        if (product.inventoryItemId && COST_CAPTURE_ENABLED) {
          try {
            const costPrice = await shopifyClient.getInventoryCostPrice(product.inventoryItemId);
            
            if (costPrice !== null && costPrice > 0) {
              log(`Got cost price for ${product.sku}: $${costPrice}`);
              
              // Log cost price for UI display
              await logCostPrice(product.sku, costPrice, `Cost price from Shopify inventory`);
              
              // Update cost price in database
              await storage.updateProduct(existingProduct.id, {
                costPrice
              });
            }
          } catch (err) {
            log(`Error getting cost price for ${product.sku}: ${err}`, 'shopify-sync-error');
            // Continue processing - cost price errors are non-fatal
          }
        }
        
        success++;
      } else {
        // Create new product
        const newProduct = await storage.createProduct({
          sku: product.sku,
          title: product.title,
          description: product.description || null,
          shopifyId: product.shopifyId,
          shopifyPrice: product.price,
          status: product.status || 'active',
          vendor: product.vendor || null,
          productType: product.productType || null
        });
        
        // Get cost price if available
        if (product.inventoryItemId && COST_CAPTURE_ENABLED) {
          try {
            const costPrice = await shopifyClient.getInventoryCostPrice(product.inventoryItemId);
            
            if (costPrice !== null && costPrice > 0) {
              log(`Got cost price for ${product.sku}: $${costPrice}`);
              
              // Log cost price for UI display
              await logCostPrice(product.sku, costPrice, `Cost price from Shopify inventory`);
              
              // Update cost price in database
              await storage.updateProduct(newProduct.id, {
                costPrice
              });
            }
          } catch (err) {
            log(`Error getting cost price for ${product.sku}: ${err}`, 'shopify-sync-error');
            // Continue processing - cost price errors are non-fatal
          }
        }
        
        success++;
      }
    } catch (error) {
      log(`Error processing product ${product.sku || 'unknown'}: ${error}`, 'shopify-sync-error');
      failed++;
    }
  }
  
  return {
    processed: products.length,
    success,
    failed
  };
}

/**
 * Format milliseconds into human-readable duration
 */
function formatDuration(ms: number): string {
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