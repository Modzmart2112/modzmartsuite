/**
 * This script fixes the price of a specific product that is showing an incorrect value
 * by updating both our database and Shopify
 */
import { storage } from './server/storage';
import { db } from './server/db';
import { shopifyClient } from './server/shopify';

async function fixProductPrice() {
  try {
    console.log('Starting fix for product SIL-RP-016');
    
    // 1. Get the product from the database
    const product = await storage.getProductBySku('SIL-RP-016');
    if (!product) {
      console.error('Product not found');
      return;
    }
    
    console.log(`Found product: ${product.title}`);
    console.log(`Current price in our database: ${product.shopifyPrice}`);
    console.log(`Shopify ID: ${product.shopifyId}`);
    
    // 2. Set the correct price (should be 14.95)
    const correctPrice = 14.95;
    
    // 3. Update in Shopify
    console.log(`Updating Shopify price to $${correctPrice}`);
    
    await shopifyClient.updateProductPrice(product.shopifyId, correctPrice);
    
    console.log('Price updated in Shopify successfully');
    
    // 4. Make sure our database has the correct price
    await storage.updateProduct(product.id, {
      shopifyPrice: correctPrice,
      onSale: false,
      originalPrice: null,
      saleEndDate: null,
      saleId: null
    });
    
    console.log('Price update completed successfully');
    console.log(`Product ${product.sku} price is now $${correctPrice}`);
    
  } catch (error) {
    console.error('Error fixing product price:', error);
  }
}

// Run the function
fixProductPrice()
  .then(() => console.log('Done'))
  .catch(error => console.error('Error:', error))
  .finally(() => process.exit(0));