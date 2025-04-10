import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in environment variables");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    console.log("Connecting to database...");
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    console.log("Database connected successfully:", result.rows[0].time);
    
    // Try to count products
    const productCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`Found ${productCount.rows[0].count} products in database`);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error("Database connection error:", error.message);
  }
}

testConnection();
