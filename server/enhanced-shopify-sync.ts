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
 * - Targeted cost-price-only sync for products missing cost price
 */

import { storage } from './storage';
import { shopifyClient } from './shopify';
import { logCostPrice } from './cost-logger';
import fetch from 'node-fetch';

// Configuration
const BATCH_SIZE = 50; // Increased batch size for better performance (was 10)
const BATCH_DELAY_MS = 100; // Reduced delay between batches for faster processing (was 500ms)
const MAX_RETRIES = 3; // Maximum retries for failed operations
const STATUS_UPDATE_INTERVAL = 1; // Update DB status after EVERY batch for more granular progress
const PROGRESS_UPDATE_THRESHOLD = 1; // Update progress after every 1% change for smoother tracking
const COST_CAPTURE_ENABLED = true; // Enable cost price capture and display
const PARALLEL_REQUESTS = 5; // Number of parallel API requests to run

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
    
    // Update global stats with last sync time
    await storage.updateStats({
      lastShopifySync: new Date()
    });
    log('Updated lastShopifySync timestamp in stats');

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
    
    // Process a small number of products at a time with progress updates
    const ORGANIZE_BATCH_SIZE = 100; // Process this many products at once during organization
    
    // Process all products in small chunks to avoid appearing to do too much at once
    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      
      if (!product.productId) continue;
      
      const productId = product.productId.toString();
      if (!productGroups.has(productId)) {
        productGroups.set(productId, []);
      }
      
      const variants = productGroups.get(productId);
      if (variants) {
        variants.push(product);
      }
      
      // Update progress periodically during organization
      if (i > 0 && i % ORGANIZE_BATCH_SIZE === 0) {
        await storage.updateShopifySyncProgress({
          status: "in-progress",
          message: `Step 2/3: Organizing products (${i}/${allProducts.length})...`,
          processedItems: 0, // Still 0 because we haven't started actual processing
          totalItems: totalVariantCount,
          details: {
            step: 2,
            stepName: "organizing",
            organizedCount: i,
            totalToOrganize: allProducts.length,
            organizingProgress: (i / allProducts.length) * 100
          }
        });
        
        // Small delay to prevent the UI from freezing
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
    
    log(`Organized products into ${productGroups.size} unique product groups`);
    
    // Add a pause before starting actual processing
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: `Step 2/3: Organization complete. Starting batch processing...`,
      processedItems: 0,
      totalItems: totalVariantCount,
      details: {
        step: 2,
        stepName: "organized",
        uniqueProductCount: productGroups.size,
        totalVariantCount,
        startingProcessing: true
      }
    });
    
    // Wait a second to ensure UI updates before processing starts
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Process in batches
    let currentBatch: any[] = [];
    let processedProducts = 0;
    
    const productIds = Array.from(productGroups.keys());
    const SMALL_BATCH_SIZE = Math.min(5, BATCH_SIZE); // Use much smaller batches initially
    
    // Process the first few batches with smaller batch size to prevent the 
    // appearance of large jumps in progress
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const variants = productGroups.get(productId) || [];
      
      // Add all variants to current batch
      currentBatch.push(...variants);
      processedProducts++;
      
      // For the first 10 groups, use smaller batches for more granular progress
      const effectiveBatchSize = i < 10 ? SMALL_BATCH_SIZE : BATCH_SIZE;
      
      // Process batch if it has reached the batch size or it's the last product
      if (currentBatch.length >= effectiveBatchSize || i === productIds.length - 1) {
        // Update progress before processing to show we're starting this batch
        await storage.updateShopifySyncProgress({
          status: "in-progress",
          message: `Step 2/3: Processing batch ${Math.floor(i / 5) + 1}...`,
          processedItems: processedCount,
          totalItems: totalVariantCount,
          details: {
            step: 2,
            stepName: "processing",
            batchNumber: Math.floor(i / 5) + 1,
            processingProduct: processedProducts,
            totalProducts: productGroups.size
          }
        });
        
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
        
        // Calculate exact percentage based on unique product SKUs processed
        // This ensures a more accurate, gradual progress display
        const exactPercentComplete = uniqueProductCount > 0 
          ? (processedProducts / uniqueProductCount) * 100 
          : 0;
        
        // Round for display, but keep tracking precise
        const percentComplete = Math.min(100, Math.round(exactPercentComplete));
        
        // Log exact percentage for debugging
        log(`Exact progress: ${exactPercentComplete.toFixed(2)}%, Displayed: ${percentComplete}%`);
        
        // Update progress in database with clearer step labeling
        await storage.updateShopifySyncProgress({
          status: "in-progress",
          message: `Step 2/3: Processing ${processedProducts} of ${uniqueProductCount} products (${percentComplete}%)`,
          processedItems: processedProducts, // Using product count instead of variant count
          totalItems: uniqueProductCount,    // Using product count as total 
          successItems: successCount,
          failedItems: failedCount,
          details: {
            step: 2,
            stepName: "processing",
            uniqueProductCount,
            processedProductCount: processedProducts,
            totalProductCount: productGroups.size,
            trackingMethod: 'skuCount',
            percentage: exactPercentComplete, // Store exact percentage for frontend
            estimatedRemainingMs,
            estimatedCompletionTime: estimatedCompletionTime.toISOString(),
            processingRate: elapsedMs > 0 ? Math.round((processedProducts / elapsedMs) * 60000) : 0, // products per minute
            elapsedTime: formatDuration(elapsedMs),
            // Add these fields to help debug the progress
            processedSkus: processedProducts,
            totalUniqueProducts: uniqueProductCount,
            batchSize: BATCH_SIZE,
            batchNumber: Math.ceil(i / STATUS_UPDATE_INTERVAL)
          }
        });
        
        log(`Step 2/3: Processed ${processedProducts}/${uniqueProductCount} products (${percentComplete}%) - ETA: ${formatDuration(estimatedRemainingMs)}`);
        
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
 * This function now processes a single product at a time with a delay
 * to ensure more granular progress tracking
 * 
 * IMPORTANT: Now tracks progress by unique SKUs processed instead of variant count
 * for more accurate user-facing progress reporting
 */
async function processBatch(products: any[]): Promise<{ 
  processed: number; 
  success: number; 
  failed: number;
}> {
  let success = 0;
  let failed = 0;
  
  // Track unique SKUs to count them accurately
  const processedSkus = new Set<string>();
  
  try {
    // First, process all product updates without cost prices
    // This allows us to get basic product info updated quickly
    const updatePromises = products.map(async (product) => {
      try {
        // Skip products without required fields
        if (!product.sku || !product.title || !product.shopifyId) {
          return { success: false };
        }
        
        // Add this SKU to our set of processed SKUs
        processedSkus.add(product.sku);
        
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
          
          // Log successful update with current sync ID - important for progress tracking
          const currentSyncId = await getCurrentSyncId();
          log(`Successfully updated product ${existingProduct.id} [SyncID: ${currentSyncId}]`);
          
          return { 
            success: true, 
            id: existingProduct.id, 
            sku: product.sku, 
            inventoryItemId: product.inventoryItemId 
          };
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
          
          // Log successful creation with current sync ID
          const currentSyncId = await getCurrentSyncId();
          log(`Successfully updated product ${newProduct.id} [SyncID: ${currentSyncId}]`);
          
          return { 
            success: true, 
            id: newProduct.id, 
            sku: product.sku, 
            inventoryItemId: product.inventoryItemId 
          };
        }
      } catch (error) {
        log(`Error processing product ${product?.sku || 'unknown'}: ${error}`, 'shopify-sync-error');
        return { success: false };
      }
    });
    
    // Wait for all update promises to complete
    const updateResults = await Promise.all(updatePromises);
    
    // Count successes and failures from initial update
    const successResults = updateResults.filter(result => result.success);
    success = successResults.length;
    failed = updateResults.length - success;
    
    // Now collect inventory item IDs for bulk cost price fetch
    if (COST_CAPTURE_ENABLED) {
      const itemsWithInventoryIds = successResults
        .filter(result => result.inventoryItemId)
        .map(result => ({
          id: result.id,
          sku: result.sku,
          inventoryItemId: result.inventoryItemId
        }));
      
      if (itemsWithInventoryIds.length > 0) {
        log(`Fetching cost prices for ${itemsWithInventoryIds.length} products in bulk`, 'shopify-sync');
        
        // Batch inventory items into chunks of 50 for API requests
        const INVENTORY_CHUNK_SIZE = 50;
        const inventoryChunks = [];
        
        // Create chunks for bulk processing
        for (let i = 0; i < itemsWithInventoryIds.length; i += INVENTORY_CHUNK_SIZE) {
          inventoryChunks.push(itemsWithInventoryIds.slice(i, i + INVENTORY_CHUNK_SIZE));
        }
        
        // Process each inventory chunk
        for (const chunk of inventoryChunks) {
          // Prepare bulk query param with comma-separated inventory IDs
          const inventoryItemIds = chunk.map(item => item.inventoryItemId).join(',');
          const credentials = await storage.getShopifyCredentials();
          
          try {
            // Get current sync ID for logging
            const syncProgress = await storage.getShopifySyncProgress();
            const currentSyncId = syncProgress?.id || 0;
            
            if (credentials) {
              const baseUrl = `https://${credentials.storeUrl}/admin/api/2022-10`;
              const url = `${baseUrl}/inventory_items.json?ids=${inventoryItemIds}`;
              
              // Make bulk request with proper headers
              const response = await fetch(url, {
                headers: {
                  'X-Shopify-Access-Token': credentials.apiSecret,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                const data = await response.json();
                
                if (data && data.inventory_items && data.inventory_items.length > 0) {
                  // Create mapping of inventory IDs to products
                  const idToItemMap = new Map();
                  chunk.forEach(item => idToItemMap.set(item.inventoryItemId, item));
                  
                  // Process all inventory items
                  for (const item of data.inventory_items) {
                    if (item.id && item.cost) {
                      const inventoryItemId = item.id.toString();
                      const costPrice = parseFloat(item.cost);
                      const product = idToItemMap.get(inventoryItemId);
                      
                      if (product) {
                        // Log cost price for UI display with proper sync ID
                        const logMessage = `Got cost price for ${product.sku}: $${costPrice} [SyncID: ${currentSyncId}]`;
                        log(logMessage);
                        await logCostPrice(product.sku, costPrice, logMessage);
                        
                        // Update product with cost price
                        await storage.updateProduct(product.id, { costPrice });
                      }
                    }
                  }
                }
              } else {
                log(`Error fetching bulk inventory items: ${response.status} ${response.statusText}`, 'shopify-sync-error');
              }
            }
          } catch (error) {
            log(`Error in bulk cost price processing: ${error}`, 'shopify-sync-error');
            // Continue with next chunk even if this one fails
          }
          
          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  } catch (error) {
    log(`Error in batch processing: ${error}`, 'shopify-sync-error');
  }
  
  // Return actual product update counts
  console.log(`Batch completed: Updated ${success} products successfully, ${failed} failed`);
  
  // Return the count based on actual product updates
  return {
    processed: success, // Use the count of successfully updated products
    success,
    failed
  };
}

/**
 * Process a single product with proper error handling
 * This helper function enables parallel processing
 */
async function processProduct(product: any, processedSkus: Set<string>): Promise<{ success: boolean }> {
  try {
    // Skip products without required fields
    if (!product.sku || !product.title || !product.shopifyId) {
      return { success: false };
    }
    
    // Add this SKU to our set of processed SKUs
    processedSkus.add(product.sku);
    
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
      
      // Log successful update with product count and current sync ID - important for progress tracking
      const syncProgress = await storage.getShopifySyncProgress();
      const currentSyncId = syncProgress?.id || 0;
      log(`Successfully updated product ${existingProduct.id} [SyncID: ${currentSyncId}]`);
      
      // Get cost price if available - direct API call approach
      if (product.inventoryItemId && COST_CAPTURE_ENABLED) {
        try {
          // Get credentials to make direct API call
          const settings = await storage.getUser(1); // Simplified: using first user
          if (settings?.shopifyApiSecret && settings?.shopifyStoreUrl) {
            const baseUrl = `https://${settings.shopifyStoreUrl}/admin/api/2022-10`;
            const url = `${baseUrl}/inventory_items/${product.inventoryItemId}.json`;
            
            // Make direct API call
            const response = await fetch(url, {
              headers: {
                'X-Shopify-Access-Token': settings.shopifyApiSecret,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              
              if (data && data.inventory_item && data.inventory_item.cost) {
                const costPrice = parseFloat(data.inventory_item.cost);
                
                // Format consistent log message with SyncID
                const logMessage = `Got cost price for ${product.sku}: $${costPrice} [SyncID: ${currentSyncId}]`;
                log(logMessage);
                
                // Log for UI display with same format
                await logCostPrice(product.sku, costPrice, logMessage);
                
                // Update database
                await storage.updateProduct(existingProduct.id, { costPrice });
              }
            }
          }
        } catch (err) {
          log(`Error getting cost price for ${product.sku}: ${err}`, 'shopify-sync-error');
          // Continue processing - cost price errors are non-fatal
        }
      }
      
      return { success: true };
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
      
      // Log successful creation with current sync ID - important for progress tracking
      const syncProgress = await storage.getShopifySyncProgress();
      const currentSyncId = syncProgress?.id || 0;
      log(`Successfully updated product ${newProduct.id} [SyncID: ${currentSyncId}]`);
      
      // Get cost price if available - direct API call approach
      if (product.inventoryItemId && COST_CAPTURE_ENABLED) {
        try {
          // Get credentials to make direct API call
          const settings = await storage.getUser(1); // Simplified: using first user
          if (settings?.shopifyApiSecret && settings?.shopifyStoreUrl) {
            const baseUrl = `https://${settings.shopifyStoreUrl}/admin/api/2022-10`;
            const url = `${baseUrl}/inventory_items/${product.inventoryItemId}.json`;
            
            // Make direct API call
            const response = await fetch(url, {
              headers: {
                'X-Shopify-Access-Token': settings.shopifyApiSecret,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              
              if (data && data.inventory_item && data.inventory_item.cost) {
                const costPrice = parseFloat(data.inventory_item.cost);
                
                // Format consistent log message with SyncID
                const logMessage = `Got cost price for ${product.sku}: $${costPrice} [SyncID: ${currentSyncId}]`;
                log(logMessage);
                
                // Log for UI display with same format
                await logCostPrice(product.sku, costPrice, logMessage);
                
                // Update database
                await storage.updateProduct(newProduct.id, { costPrice });
              }
            }
          }
        } catch (err) {
          log(`Error getting cost price for ${product.sku}: ${err}`, 'shopify-sync-error');
          // Continue processing - cost price errors are non-fatal
        }
      }
      
      return { success: true };
    }
  } catch (error) {
    log(`Error processing product ${product?.sku || 'unknown'}: ${error}`, 'shopify-sync-error');
    return { success: false };
  }
}

/**
 * Specialized function that only syncs products without cost prices
 * This function uses a multi-stage approach for maximum reliability:
 * 1. First try to get cost prices from Shopify API 
 * 2. Then check shopify_logs for any previously recorded cost prices
 * 3. Finally, set default cost prices based on retail price (65%)
 * 
 * This approach ensures we get cost prices for all products with minimal API calls.
 */
export async function syncProductsWithoutCostPrice(): Promise<void> {
  // Create a new sync record for this specialized operation
  let syncProgress = await storage.initializeShopifySyncProgress();
  log(`Starting enhanced cost-price-only sync with ID ${syncProgress.id}`);
  const startTime = Date.now();
  
  try {
    // Get API credentials
    const settings = await storage.getUser(1);
    if (!settings?.shopifyApiKey || !settings?.shopifyApiSecret || !settings?.shopifyStoreUrl) {
      await storage.updateShopifySyncProgress({
        status: "failed",
        message: "Shopify API credentials are missing or incomplete",
        completedAt: new Date(),
        details: {
          error: "API credentials missing",
          syncType: "enhanced-cost-price-sync"
        }
      });
      log("Cost price sync failed: Shopify API credentials are missing or incomplete");
      return;
    }
    
    // Extract credentials
    const { shopifyApiKey, shopifyApiSecret, shopifyStoreUrl } = settings;
    
    // Get all products without cost prices from our database
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: "Identifying products without cost prices...",
      details: {
        syncType: "enhanced-cost-price-sync",
        step: "identifying"
      }
    });
    
    // Get products without cost prices
    const productsWithoutCostPrice = await storage.getProductsWithoutCostPrice();
    const productCount = productsWithoutCostPrice.length;
    
    log(`Found ${productCount} products without cost prices`);
    
    if (productCount === 0) {
      await storage.updateShopifySyncProgress({
        status: "complete",
        message: "No products without cost prices found",
        completedAt: new Date(),
        details: {
          syncType: "enhanced-cost-price-sync",
          productsChecked: 0
        }
      });
      
      // Update global stats
      await storage.updateStats({
        lastShopifySync: new Date()
      });
      
      return;
    }
    
    // Group products by batch size for API requests
    const BATCH_SIZE = 50;
    const batches = [];
    
    for (let i = 0; i < productCount; i += BATCH_SIZE) {
      batches.push(productsWithoutCostPrice.slice(i, i + BATCH_SIZE));
    }
    
    // Update progress to show we're starting to process
    await storage.updateShopifySyncProgress({
      status: "in-progress",
      message: `STAGE 1: Retrieving cost prices from Shopify API...`,
      totalItems: productCount,
      processedItems: 0,
      details: {
        syncType: "enhanced-cost-price-sync",
        batchCount: batches.length,
        step: "stage-1-api",
        stage: 1,
        description: "Checking Shopify for cost prices"
      }
    });
    
    // Process each batch
    let processedCount = 0;
    let updatedFromShopify = 0;
    let localSkipped = 0;
    let failedCount = 0;
    
    // Keep track of products that still need cost prices after Stage 1
    const remainingProducts = [];
    
    // STAGE 1: Try to get cost prices from Shopify API first
    log("STAGE 1: Retrieving cost prices from Shopify API");
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;
      
      // Update progress for this batch
      await storage.updateShopifySyncProgress({
        status: "in-progress",
        message: `STAGE 1: Processing batch ${batchNumber}/${batches.length}...`,
        processedItems: processedCount,
        totalItems: productCount,
        details: {
          syncType: "enhanced-cost-price-sync",
          currentBatch: batchNumber,
          totalBatches: batches.length,
          progress: (processedCount / productCount) * 100,
          stage: 1
        }
      });
      
      // Process this batch - collect inventory item IDs
      const inventoryItemIds = [];
      const productMap = new Map(); // Map inventory item IDs to our product records
      
      for (const product of batch) {
        // Skip products with placeholder local IDs since they don't exist in Shopify
        if (product.shopifyId && !product.shopifyId.startsWith('local-')) {
          try {
            // Get the inventory item ID for this product
            const shopifyProduct = await shopifyClient.getProductByID(
              shopifyApiKey, 
              shopifyApiSecret, 
              shopifyStoreUrl,
              product.shopifyId
            );
            
            if (shopifyProduct && shopifyProduct.inventoryItemId) {
              inventoryItemIds.push(shopifyProduct.inventoryItemId);
              productMap.set(shopifyProduct.inventoryItemId, product);
            } else {
              // If we couldn't get the inventory item ID, add to remaining products
              remainingProducts.push(product);
            }
          } catch (error) {
            log(`Error getting inventory item ID for product ${product.sku}: ${error}`, "cost-price-sync");
            // Add to remaining products to try fallback methods
            remainingProducts.push(product);
          }
        } else if (product.shopifyId && product.shopifyId.startsWith('local-')) {
          // Skip products with local IDs but don't count as failures
          log(`Skipping product ${product.sku} with local ID (not in Shopify)`, "cost-price-sync");
          localSkipped++;
          remainingProducts.push(product); // Still add to remaining for fallback calculation
        } else {
          // No shopify ID, add to remaining
          remainingProducts.push(product);
        }
        
        processedCount++;
      }
      
      // Get cost prices in bulk if we have inventory item IDs
      if (inventoryItemIds.length > 0) {
        try {
          // Fetch cost prices for these inventory items
          const inventoryItemIdsParam = inventoryItemIds.join(',');
          
          // Get bulk inventory item data
          const inventory = await shopifyClient.getInventoryItemsByIds(
            shopifyApiKey,
            shopifyApiSecret,
            shopifyStoreUrl,
            inventoryItemIdsParam
          );
          
          // Process inventory items
          if (inventory && inventory.inventory_items) {
            for (const item of inventory.inventory_items) {
              if (item.id && item.cost && productMap.has(item.id)) {
                const product = productMap.get(item.id);
                const costPrice = parseFloat(item.cost);
                
                // Update the product with cost price
                await storage.updateProduct(product.id, {
                  costPrice
                });
                
                // Log the cost price for real-time UI display
                await logCostPrice(product.sku, costPrice, `Updated cost price for ${product.sku}: ${costPrice} (from Shopify API)`);
                
                updatedFromShopify++;
                
                // Remove this product from remaining products since we got a cost price
                const index = remainingProducts.findIndex(p => p.id === product.id);
                if (index !== -1) {
                  remainingProducts.splice(index, 1);
                }
                
                log(`Updated cost price for ${product.sku}: ${costPrice} (from Shopify API)`);
              }
            }
          }
        } catch (error) {
          log(`Error processing inventory items: ${error}`, "cost-price-sync");
          // We don't mark these as failed since we'll try fallback methods
        }
      }
      
      // Update progress after this batch
      await storage.updateShopifySyncProgress({
        processedItems: processedCount,
        successItems: updatedFromShopify,
        failedItems: failedCount,
        details: {
          syncType: "enhanced-cost-price-sync",
          progress: (processedCount / productCount) * 100,
          timeElapsed: formatDuration(Date.now() - startTime),
          remainingProducts: remainingProducts.length,
          stage: 1
        }
      });
      
      // Add a small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // STAGE 2: Extract cost prices from logs for remaining products
    const remainingCount = remainingProducts.length;
    log(`STAGE 2: Checking logs for ${remainingCount} products still missing cost prices`);
    
    await storage.updateShopifySyncProgress({
      message: `STAGE 2: Checking logs for ${remainingCount} products still missing cost prices`,
      details: {
        syncType: "enhanced-cost-price-sync",
        stage: 2,
        description: "Extracting cost prices from logs",
        remainingProducts: remainingCount
      }
    });
    
    let logBasedUpdates = 0;
    const productsAfterLogCheck = [];
    
    // Import PostgreSQL client
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Check logs for each remaining product in batches
    for (let i = 0; i < remainingProducts.length; i++) {
      const product = remainingProducts[i];
      
      try {
        // Look for cost price logs for this SKU
        const logResult = await pool.query(`
          SELECT metadata->>'price' AS price 
          FROM shopify_logs 
          WHERE message LIKE $1 
          ORDER BY created_at DESC 
          LIMIT 1
        `, [`Got cost price for ${product.sku}:%`]);
        
        if (logResult.rows.length > 0 && logResult.rows[0].price) {
          const price = parseFloat(logResult.rows[0].price);
          
          // Update the product with the price from the log
          await storage.updateProduct(product.id, { costPrice: price });
          
          // Log to UI and console
          await logCostPrice(product.sku, price, `Updated cost price for ${product.sku}: ${price} (from logs)`);
          log(`Updated cost price for ${product.sku}: ${price} (from logs)`);
          
          logBasedUpdates++;
        } else {
          // No log entry found, keep in list for stage 3
          productsAfterLogCheck.push(product);
        }
      } catch (error) {
        log(`Error processing logs for ${product.sku}: ${error}`, "cost-price-sync");
        productsAfterLogCheck.push(product);
      }
      
      // Update progress periodically
      if (i % 10 === 0 || i === remainingProducts.length - 1) {
        await storage.updateShopifySyncProgress({
          successItems: updatedFromShopify + logBasedUpdates,
          details: {
            syncType: "enhanced-cost-price-sync",
            stage: 2,
            logBasedUpdates,
            remainingAfterLogs: productsAfterLogCheck.length,
            progress: ((i + 1) / remainingProducts.length) * 100
          }
        });
      }
    }
    
    // Clean up DB connection
    await pool.end();
    
    // STAGE 3: Set default cost prices for any remaining products based on retail price
    const finalRemainingCount = productsAfterLogCheck.length;
    log(`STAGE 3: Setting default cost prices for ${finalRemainingCount} products still missing cost prices`);
    
    await storage.updateShopifySyncProgress({
      message: `STAGE 3: Setting default cost prices for ${finalRemainingCount} products`,
      details: {
        syncType: "enhanced-cost-price-sync",
        stage: 3,
        description: "Calculating default cost prices (65% of retail)",
        remainingProducts: finalRemainingCount
      }
    });
    
    let defaultPriceUpdates = 0;
    
    // Set default cost prices for remaining products
    for (let i = 0; i < productsAfterLogCheck.length; i++) {
      const product = productsAfterLogCheck[i];
      
      try {
        // Calculate a default cost price as 65% of the shopify_price
        if (product.shopifyPrice) {
          const defaultCostPrice = parseFloat((product.shopifyPrice * 0.65).toFixed(2));
          
          // Update the product with the calculated cost price
          await storage.updateProduct(product.id, { costPrice: defaultCostPrice });
          
          // Log to UI and console
          await logCostPrice(
            product.sku, 
            defaultCostPrice, 
            `Set default cost price for ${product.sku}: ${defaultCostPrice} (calculated from retail price)`
          );
          log(`Set default cost price for ${product.sku}: ${defaultCostPrice} (calculated from retail price)`);
          
          defaultPriceUpdates++;
        } else {
          failedCount++;
          log(`Cannot set default cost price for ${product.sku}: No retail price available`);
        }
      } catch (error) {
        failedCount++;
        log(`Error setting default cost price for ${product.sku}: ${error}`, "cost-price-sync");
      }
      
      // Update progress periodically
      if (i % 10 === 0 || i === productsAfterLogCheck.length - 1) {
        await storage.updateShopifySyncProgress({
          successItems: updatedFromShopify + logBasedUpdates + defaultPriceUpdates,
          failedItems: failedCount,
          details: {
            syncType: "enhanced-cost-price-sync",
            stage: 3,
            defaultPriceUpdates,
            progress: ((i + 1) / productsAfterLogCheck.length) * 100
          }
        });
      }
    }
    
    // Calculate total updates
    const totalUpdatedCount = updatedFromShopify + logBasedUpdates + defaultPriceUpdates;
    
    // Complete the sync
    const totalTimeMs = Date.now() - startTime;
    
    await storage.updateShopifySyncProgress({
      status: "complete",
      message: `Enhanced cost price sync completed: ${totalUpdatedCount} products updated (${updatedFromShopify} from API, ${logBasedUpdates} from logs, ${defaultPriceUpdates} defaults)`,
      processedItems: processedCount,
      totalItems: productCount,
      successItems: totalUpdatedCount,
      failedItems: failedCount,
      completedAt: new Date(),
      details: {
        syncType: "enhanced-cost-price-sync",
        totalDuration: totalTimeMs,
        formattedDuration: formatDuration(totalTimeMs),
        shopifyUpdates: updatedFromShopify,
        logBasedUpdates: logBasedUpdates,
        defaultPriceUpdates: defaultPriceUpdates,
        skippedLocalProductCount: localSkipped
      }
    });
    
    // Update global stats
    await storage.updateStats({
      lastShopifySync: new Date()
    });
    
    log(`Enhanced cost price sync completed in ${formatDuration(totalTimeMs)}`);
    log(`Results: ${totalUpdatedCount} cost prices updated (${updatedFromShopify} from API, ${logBasedUpdates} from logs, ${defaultPriceUpdates} defaults), ${failedCount} failed`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Unexpected error in enhanced cost price sync: ${errorMessage}`, 'cost-price-sync-error');
    
    // Update progress with error information
    await storage.updateShopifySyncProgress({
      status: "failed",
      message: `Enhanced cost price sync failed: ${errorMessage}`,
      completedAt: new Date(),
      details: {
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
        syncType: "enhanced-cost-price-sync"
      }
    });
  }
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

/**
 * Get the current sync ID for adding to log messages
 * This allows us to filter by sync session in the UI
 */
async function getCurrentSyncId(): Promise<number> {
  try {
    const syncProgress = await storage.getShopifySyncProgress();
    return syncProgress?.id || 0;
  } catch (error) {
    console.error("Error getting current sync ID:", error);
    return 0;
  }
}