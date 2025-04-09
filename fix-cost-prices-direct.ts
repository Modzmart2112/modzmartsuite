import pg from 'pg';
const { Pool } = pg;

/**
 * This script directly fixes cost prices by using information from shopify_logs
 * It's a more targeted approach than the previous scripts
 */
async function directFixCostPrices() {
  // Connect to the database
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting to fix cost prices directly...');
    
    // Find products with missing cost prices
    const missingCostPriceResult = await pool.query(`
      SELECT id, sku, shopify_price 
      FROM products 
      WHERE (cost_price IS NULL OR cost_price = 0)
      ORDER BY id DESC
    `);
    
    console.log(`Found ${missingCostPriceResult.rows.length} products with missing cost prices`);
    
    // For each product with missing cost price, look for a log entry
    let updatedCount = 0;
    
    for (const product of missingCostPriceResult.rows) {
      // Find the most recent cost price log for this SKU
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
        await pool.query(
          'UPDATE products SET cost_price = $1 WHERE id = $2',
          [price, product.id]
        );
        
        console.log(`Updated cost price for ${product.sku} (ID: ${product.id}) to $${price}`);
        updatedCount++;
      } else {
        // If no log found, calculate a default cost price that's 65% of the shopify_price
        const defaultPrice = product.shopify_price * 0.65;
        await pool.query(
          'UPDATE products SET cost_price = $1 WHERE id = $2',
          [defaultPrice, product.id]
        );
        
        console.log(`Set default cost price for ${product.sku} (ID: ${product.id}) to $${defaultPrice.toFixed(2)} (65% of retail price)`);
        updatedCount++;
      }
      
      // Sleep for a short time to avoid overwhelming the DB
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`Successfully updated cost prices for ${updatedCount} products`);
    
  } catch (error) {
    console.error('Error fixing cost prices:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
directFixCostPrices()
  .then(() => console.log('Cost price direct fix completed'))
  .catch(error => console.error('Failed to fix cost prices:', error));