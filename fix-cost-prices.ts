// We need to use CommonJS imports
const pg = require('pg');
const Pool = pg.Pool;

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
  } catch (error) {
    console.error('Error fixing cost prices:', error);
  } finally {
    await pool.end();
  }
}

// Run the script if executed directly
if (require.main === module) {
  fixCostPrices()
    .then(() => console.log('Cost price fix completed'))
    .catch(error => console.error('Failed to fix cost prices:', error));
}