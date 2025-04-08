// CommonJS imports for database access
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
    // Use the inventory_data JSON which contains actual cost price from Shopify
    const result = await pool.query(`
      SELECT 
        p.id, 
        p.sku, 
        p.cost_price,
        (logs.metadata->>'inventory_data')::jsonb->'inventory_item'->>'cost' AS extracted_cost
      FROM 
        products p
      JOIN LATERAL (
        SELECT metadata FROM shopify_logs 
        WHERE message LIKE 'Got cost price for ' || p.sku || ': %' 
        ORDER BY created_at DESC 
        LIMIT 1
      ) logs ON true
      WHERE 
        (p.cost_price IS NULL OR p.cost_price = 0) 
        AND logs.metadata IS NOT NULL
        AND (logs.metadata->>'inventory_data')::jsonb->'inventory_item'->>'cost' IS NOT NULL
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
    
    // In our database, there is no "costPrice" column - it's handled in JavaScript, not at the DB level
    // So this section is no longer needed, but we'll keep it for reference
    const resultCamelCaseCheck = { rows: [] };
    
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