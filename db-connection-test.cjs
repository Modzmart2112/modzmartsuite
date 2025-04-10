const { Pool } = require('pg');

async function testDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set!");
    return;
  }
  
  console.log("DATABASE_URL is set, attempting connection...");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const client = await pool.connect();
    console.log("Successfully connected to database!");
    
    // Test basic query
    const result = await client.query('SELECT NOW() as time');
    console.log(`Database server time: ${result.rows[0].time}`);
    
    // Check if products table exists and has data
    try {
      const productsResult = await client.query('SELECT COUNT(*) FROM products');
      console.log(`Products table exists with ${productsResult.rows[0].count} records`);
      
      // Get a sample of products
      if (parseInt(productsResult.rows[0].count) > 0) {
        const sampleProducts = await client.query('SELECT id, sku, title, cost_price FROM products LIMIT 3');
        console.log("Sample products:");
        sampleProducts.rows.forEach(p => {
          console.log(`  ID: ${p.id}, SKU: ${p.sku}, Title: ${p.title.substring(0, 30)}..., Cost: $${p.cost_price}`);
        });
      }
    } catch (err) {
      console.error("Error with products table:", err.message);
    }
    
    client.release();
  } catch (err) {
    console.error("Database connection error:", err.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
