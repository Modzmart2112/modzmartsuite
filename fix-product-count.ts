/**
 * This script fixes the inconsistency between actual unique Shopify product count
 * and what's stored in our database. It will check with Shopify for the actual count
 * of unique products and update our database stats accordingly.
 */

import { db } from "./server/db";
import { shopifyClient } from "./server/shopify";
import { storage } from "./server/storage";

async function fixProductCount() {
  try {
    console.log("Starting to fix product count...");
    
    // Get the user's Shopify credentials
    const user = await storage.getUser(1); // Simplified: using first user
    
    if (!user?.shopifyApiKey || !user?.shopifyApiSecret || !user?.shopifyStoreUrl) {
      console.error("Shopify connection not configured");
      return;
    }

    console.log("Fetching products from Shopify to get accurate count...");
    
    // Get all products from Shopify with our fixed counting logic
    const allProducts = await shopifyClient.getAllProducts(
      user.shopifyApiKey, 
      user.shopifyApiSecret, 
      user.shopifyStoreUrl
    );
    
    // Count unique products using productId as a distinguishing factor
    const uniqueProductIds = new Set();
    allProducts.forEach(product => {
      if (product.productId) {
        uniqueProductIds.add(product.productId);
      }
    });
    
    const uniqueProductCount = uniqueProductIds.size;
    console.log(`Found ${uniqueProductCount} unique products (${allProducts.length} total variants)`);
    
    // Now update the stats table in the database
    const stats = await storage.getStats();
    if (!stats) {
      console.error("Stats record not found in database");
      return;
    }
    
    console.log(`Current product count in stats: ${stats.productCount}`);
    
    // Update stats with correct product count
    await storage.updateStats({
      productCount: uniqueProductCount
    });
    
    console.log(`Stats updated. Product count is now ${uniqueProductCount}`);
    
    // Also update the stats in the shopify_sync_progress table if there's an active record
    const progress = await storage.getShopifySyncProgress();
    if (progress) {
      console.log(`Updating shopify_sync_progress table with correct product count: ${uniqueProductCount}`);
      
      await storage.updateShopifySyncProgress({
        totalItems: allProducts.length,
        details: {
          ...progress.details,
          uniqueProductCount
        }
      });
    }
    
    console.log("Product count fix completed successfully");
  } catch (error) {
    console.error("Error fixing product count:", error);
  }
}

// Run the function
fixProductCount().catch(console.error);