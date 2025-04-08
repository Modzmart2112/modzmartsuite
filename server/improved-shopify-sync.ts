/**
 * Improved Shopify Sync Implementation
 * 
 * This module provides a more efficient and user-friendly way to sync products
 * from Shopify by:
 * 1. First counting the total products and variants
 * 2. Providing a reliable ETA for completion
 * 3. Using batch processing where possible
 * 4. Providing better progress tracking
 * 5. Ensuring clean termination when complete
 * 
 * The sync process has 3 clear steps:
 * Step 1: Count total products needing to be synced
 * Step 2: Process products with ETA on completion
 * Step 3: Complete the sync and wait for manual restart
 */

import { shopifyClient } from './shopify';
import { storage } from './storage';
import { log } from './vite';
import { logCostPrice } from './cost-logger';

// Constants for time calculations and batch processing
const AVERAGE_PROCESSING_TIME_MS = 500; // Estimated time to process one product
const BATCH_SIZE = 50; // Number of products to process in each batch
const BATCH_DELAY_MS = 1000; // Delay between batches to avoid rate limits

/**
 * Improved Shopify sync implementation
 * This implementation first counts all products, then processes them in an efficient manner
 */
export async function improvedSyncShopifyProducts(): Promise<void> {
  try {
    // Initialize sync progress
    let syncProgress = await storage.initializeShopifySyncProgress();
    
    // Update progress status to indicate we're starting
    syncProgress = await storage.updateShopifySyncProgress({
      status: "in-progress",
      totalItems: 0,
      processedItems: 0,
      successItems: 0, 
      failedItems: 0,
      message: "Initializing Shopify product sync..."
    });
    
    // Get Shopify credentials from first user
    const user = await storage.getUser(1);
    
    if (!user || !user.shopifyApiKey || !user.shopifyApiSecret || !user.shopifyStoreUrl) {
      log("Shopify credentials not configured", "shopify-sync");
      
      await storage.updateShopifySyncProgress({
        status: "error",
        completedAt: new Date(),
        message: "Shopify credentials not configured"
      });
      
      return;
    }
    
    // Validate store URL
    let storeUrl = user.shopifyStoreUrl;
    
    // Add protocol if missing
    if (!storeUrl.startsWith('http://') && !storeUrl.startsWith('https://')) {
      storeUrl = 'https://' + storeUrl;
      log(`Added https:// protocol to store URL: ${storeUrl}`, "shopify-sync");
    }
    
    // Check if URL is valid
    try {
      new URL(storeUrl);
    } catch (error) {
      log(`Invalid Shopify store URL: ${storeUrl}`, "shopify-sync");
      
      await storage.updateShopifySyncProgress({
        status: "error",
        completedAt: new Date(),
        message: "Invalid Shopify store URL"
      });
      
      return;
    }
    
    log(`Starting improved Shopify product sync with URL: ${storeUrl}`, "shopify-sync");
    
    // PHASE 1: Count products and prepare for sync
    await storage.updateShopifySyncProgress({
      message: "Counting products in your Shopify store..."
    });
    
    // First, get a count of total products (not variants)
    let shopifyProducts: any[] = [];
    let uniqueProductIds = new Set();
    let uniqueVariantCount = 0;
    
    try {
      // Get all products from Shopify
      log("Retrieving product count from Shopify...", "shopify-sync");
      shopifyProducts = await shopifyClient.getAllProducts(
        user.shopifyApiKey,
        user.shopifyApiSecret,
        storeUrl
      );
      
      // Count unique products and variants
      for (const product of shopifyProducts) {
        if (product.productId) {
          uniqueProductIds.add(product.productId);
        }
        uniqueVariantCount++;
      }
      
      // Calculate an estimated completion time
      const estimatedTotalTimeMs = uniqueVariantCount * AVERAGE_PROCESSING_TIME_MS;
      const estimatedCompletionDate = new Date(Date.now() + estimatedTotalTimeMs);
      
      log(`Found ${uniqueProductIds.size} unique products (${uniqueVariantCount} total variants) in Shopify`, "shopify-sync");
      
      // Update progress with accurate counts and ETA
      await storage.updateShopifySyncProgress({
        totalItems: uniqueVariantCount,
        processedItems: 0,
        successItems: 0,
        failedItems: 0,
        message: `Starting to process ${uniqueProductIds.size} products (${uniqueVariantCount} variants)`,
        details: {
          uniqueProductCount: uniqueProductIds.size,
          estimatedCompletionTime: estimatedCompletionDate.toISOString(),
          percentage: 0,
          isEstimate: false
        }
      });
    } catch (error) {
      log(`Error fetching product count from Shopify: ${error}`, "shopify-sync");
      
      await storage.updateShopifySyncProgress({
        status: "error",
        completedAt: new Date(),
        message: `Failed to count products: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return;
    }
    
    // PHASE 2: Process products
    if (shopifyProducts.length === 0) {
      log("No products found in Shopify store", "shopify-sync");
      
      await storage.updateShopifySyncProgress({
        status: "complete",
        completedAt: new Date(),
        message: "No products found in Shopify store"
      });
      
      return;
    }
    
    // Counters for tracking progress
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let startTime = Date.now();
    
    // Process products in batches for better performance
    const processBatch = async (productsToProcess: any[]) => {
      for (const shopifyProduct of productsToProcess) {
        try {
          // Skip products without SKUs
          if (!shopifyProduct.sku) {
            log(`Skipping product without SKU: ${shopifyProduct.title}`, "shopify-sync");
            processedCount++;
            failedCount++;
            continue;
          }
          
          // Look for existing product in the database
          const existingProduct = await storage.getProductBySku(shopifyProduct.sku);
          
          // Prepare product data
          const productData = {
            sku: shopifyProduct.sku,
            title: shopifyProduct.title,
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
            logCostPrice(shopifyProduct.sku, shopifyProduct.cost);
          }
          
          successCount++;
        } catch (error) {
          log(`Error processing product ${shopifyProduct.sku}: ${error}`, "shopify-sync");
          failedCount++;
        } finally {
          // Update counters
          processedCount++;
          
          // Update progress percentage and ETA
          const elapsedTimeMs = Date.now() - startTime;
          const averageTimePerItem = elapsedTimeMs / processedCount;
          const remainingItems = uniqueVariantCount - processedCount;
          const estimatedRemainingTimeMs = remainingItems * averageTimePerItem;
          const estimatedCompletionDate = new Date(Date.now() + estimatedRemainingTimeMs);
          const percentage = Math.round((processedCount / uniqueVariantCount) * 100);
          
          // Update progress every 10 items or at specific percentage milestones
          if (processedCount % 10 === 0 || 
              percentage % 5 === 0 || 
              processedCount === uniqueVariantCount) {
            await storage.updateShopifySyncProgress({
              processedItems: processedCount,
              successItems: successCount,
              failedItems: failedCount,
              message: `Processing products: ${processedCount} of ${uniqueVariantCount} items processed so far`,
              details: {
                uniqueProductCount: uniqueProductIds.size,
                estimatedCompletionTime: estimatedCompletionDate.toISOString(),
                percentage,
                isEstimate: false,
                elapsedTime: elapsedTimeMs,
                averageTimePerItem
              }
            });
            
            log(`Progress: ${processedCount}/${uniqueVariantCount} items (${percentage}%)`, "shopify-sync");
          }
        }
      }
    };

    // Split products into batches and process them
    for (let i = 0; i < shopifyProducts.length; i += BATCH_SIZE) {
      const batch = shopifyProducts.slice(i, i + BATCH_SIZE);
      log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(shopifyProducts.length / BATCH_SIZE)}`, "shopify-sync");
      
      // Process this batch
      await processBatch(batch);
      
      // Add a delay between batches to avoid rate limits
      if (i + BATCH_SIZE < shopifyProducts.length) {
        log(`Pausing for ${BATCH_DELAY_MS}ms before next batch...`, "shopify-sync");
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    // Finalize sync
    const totalTimeMs = Date.now() - startTime;
    const formattedTime = formatTime(totalTimeMs);
    
    log(`Sync completed: ${successCount} products updated, ${failedCount} failed in ${formattedTime}`, "shopify-sync");
    
    // Update final progress
    await storage.updateShopifySyncProgress({
      status: "complete",
      completedAt: new Date(),
      processedItems: processedCount,
      successItems: successCount,
      failedItems: failedCount,
      message: `Sync completed: ${successCount} products updated, ${failedCount} failed in ${formattedTime}`,
      details: {
        uniqueProductCount: uniqueProductIds.size,
        percentage: 100,
        totalTime: totalTimeMs,
        isEstimate: false
      }
    });
    
    // Update stats record with last sync date
    await storage.updateStats({
      lastShopifySync: new Date()
    });
    
  } catch (error) {
    log(`Unhandled error in Shopify sync: ${error}`, "shopify-sync");
    
    // Mark sync as failed
    await storage.updateShopifySyncProgress({
      status: "error",
      completedAt: new Date(),
      message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Formats milliseconds into a human-readable time string
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