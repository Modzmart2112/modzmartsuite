const { Pool } = require('pg');

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log("Connecting to database...");
    const client = await pool.connect();
    
    console.log("Connected! Checking tables...");
    
    // Check tables
    const tables = ['products', 'stats', 'shopify_logs', 'notifications'];
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`Table ${table} exists with ${result.rows[0].count} records`);
      } catch (error) {
        console.error(`Error with table ${table}: ${error.message}`);
      }
    }
    
    // Check specific products
    try {
      const productSample = await client.query(`SELECT id, sku, title, cost_price FROM products LIMIT 5`);
      console.log("Sample products:");
      console.log(productSample.rows);
    } catch (error) {
      console.error(`Error fetching products: ${error.message}`);
    }
    
    client.release();
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
  } finally {
    pool.end();
  }
}

checkDatabase();
