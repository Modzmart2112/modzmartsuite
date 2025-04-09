import pg from 'pg';
const { Pool } = pg;

/**
 * This script fixes the issue with cost prices not always being properly saved
 * It directly updates the database using SQL to ensure consistency
 */
async function fixCostPrices() {
  // Connect to the database
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting to fix cost prices...');
    
    // First, identify products that might have missing cost prices
    const result = await pool.query(`
      SELECT 
        l.sku, 
        CAST(REGEXP_REPLACE(l.message, '.*\\$([0-9.]+).*', '\\1') AS NUMERIC) AS extracted_cost,
        p.cost_price
      FROM 
        logs l
      JOIN 
        products p ON l.sku = p.sku
      WHERE 
        l.type = 'shopify' 
        AND l.message LIKE 'Got cost price for%'
        AND (p.cost_price IS NULL OR p.cost_price = 0)
      ORDER BY 
        l.created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} products with potential cost price issues`);
    
    // Apply the fixes
    let updateCount = 0;
    for (const row of result.rows) {
      if (row.extracted_cost && (!row.cost_price || row.cost_price === 0)) {
        await pool.query(
          'UPDATE products SET cost_price = $1 WHERE sku = $2',
          [row.extracted_cost, row.sku]
        );
        console.log(`Updated cost price for ${row.sku} to $${row.extracted_cost}`);
        updateCount++;
      }
    }
    
    console.log(`Fixed cost prices for ${updateCount} products`);
    
    // Now check for situations where there's a costPrice (camelCase) but no cost_price (snake_case)
    const resultCamelCaseCheck = await pool.query(`
      SELECT id, sku, cost_price, "costPrice" 
      FROM products 
      WHERE "costPrice" IS NOT NULL AND "costPrice" > 0 
        AND (cost_price IS NULL OR cost_price = 0)
    `);
    
    console.log(`Found ${resultCamelCaseCheck.rows.length} products with camelCase/snake_case inconsistency`);
    
    // Apply the fixes
    let camelCaseFixCount = 0;
    for (const row of resultCamelCaseCheck.rows) {
      if (row.costPrice && (!row.cost_price || row.cost_price === 0)) {
        await pool.query(
          'UPDATE products SET cost_price = $1 WHERE id = $2',
          [row.costPrice, row.id]
        );
        console.log(`Fixed camelCase/snake_case inconsistency for ${row.sku}: cost_price = ${row.costPrice}`);
        camelCaseFixCount++;
      }
    }
    
    console.log(`Fixed ${camelCaseFixCount} camelCase/snake_case inconsistencies`);

    // For products that still don't have cost prices, set a default
    // Only do this for specific range (newer products above ID 1369)
    const defaultCostPriceResult = await pool.query(`
      SELECT COUNT(*) FROM products 
      WHERE id > 1369 AND (cost_price IS NULL OR cost_price = 0)
    `);
    
    const missingCostPriceCount = parseInt(defaultCostPriceResult.rows[0].count);
    console.log(`Found ${missingCostPriceCount} newer products (ID > 1369) still missing cost prices`);
    
    if (missingCostPriceCount > 0) {
      // Use a random default that's based on percentage of shopify_price
      const updateDefaultsResult = await pool.query(`
        UPDATE products 
        SET cost_price = ROUND(shopify_price * 0.65, 2)
        WHERE id > 1369 AND (cost_price IS NULL OR cost_price = 0)
      `);
      
      console.log(`Added default cost prices for ${updateDefaultsResult.rowCount} products`);
    }
    
  } catch (error) {
    console.error('Error fixing cost prices:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
fixCostPrices()
  .then(() => console.log('Cost price fix completed'))
  .catch(error => console.error('Failed to fix cost prices:', error));