/**
 * Simple Render Deployment Script
 * Focuses on minimal server to just serve files and API endpoints
 */

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

// Configuration
const PORT = process.env.PORT || 10000;
process.env.NODE_ENV = 'production';

// Initialize path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'dist', 'public');

// Create Express app
const app = express();
app.use(express.json());

console.log('Starting Simple Render Deployment');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Public path: ${publicPath}`);

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Create a DB pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper function for safe date
function safeDate() {
  return new Date().toISOString();
}

// Required API endpoints
app.get('/api/user/profile', (req, res) => {
  res.json({
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    createdAt: safeDate(),
    updatedAt: safeDate()
  });
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.json([]);
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM products');
    res.json({
      productCount: parseInt(result.rows[0].count) || 0,
      displayCount: parseInt(result.rows[0].count) || 0,
      syncedProducts: parseInt(result.rows[0].count) || 0,
      lastSync: safeDate()
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.json({
      productCount: 0,
      displayCount: 0,
      syncedProducts: 0,
      lastSync: safeDate()
    });
  }
});

// Add other API endpoints
[
  '/api/dashboard/activity',
  '/api/shopify/status',
  '/api/shopify/connection-status',
  '/api/shopify/brands',
  '/api/products/discrepancies',
  '/api/notifications',
  '/api/scheduler/status',
  '/api/scheduler/shopify-sync-progress'
].forEach(endpoint => {
  app.get(endpoint, (req, res) => {
    // Return a simple valid response for each endpoint
    res.json({
      status: 'ok',
      timestamp: safeDate()
    });
  });
});

// Create a simple fallback page in case the frontend doesn't load
const fallbackHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MODZ Suite</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      margin: 0;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { margin-top: 40px; color: #2563eb; }
    .card {
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px;
      margin: 20px 0;
      background: white;
    }
    .products {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
    }
    .product {
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 15px;
    }
    .loading { opacity: 0.5; }
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    .count {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <h1>MODZ Suite Dashboard</h1>
  
  <div class="card">
    <h2>Products</h2>
    <div id="productCount" class="count">Loading...</div>
    <button onclick="refreshStats()">Refresh Stats</button>
  </div>
  
  <div class="card">
    <h2>Recent Products</h2>
    <div id="products" class="products loading">Loading product data...</div>
    <button onclick="loadProducts()">Load Products</button>
  </div>
  
  <script>
    // Simple data fetching
    async function fetchJson(url) {
      try {
        const response = await fetch(url);
        return await response.json();
      } catch (err) {
        console.error('Error fetching:', url, err);
        return null;
      }
    }
    
    // Load stats
    async function refreshStats() {
      const stats = await fetchJson('/api/dashboard/stats');
      if (stats) {
        document.getElementById('productCount').textContent = stats.productCount || 0;
      } else {
        document.getElementById('productCount').textContent = 'Error loading stats';
      }
    }
    
    // Load products
    async function loadProducts() {
      const productsEl = document.getElementById('products');
      productsEl.innerHTML = 'Loading...';
      productsEl.classList.add('loading');
      
      const products = await fetchJson('/api/products');
      
      if (products && products.length > 0) {
        productsEl.innerHTML = '';
        products.slice(0, 6).forEach(product => {
          productsEl.innerHTML += \`
            <div class="product">
              <h3>\${product.title || 'Untitled'}</h3>
              <p>SKU: \${product.sku || 'N/A'}</p>
              <p>Price: \${product.price ? '$' + product.price : 'N/A'}</p>
            </div>
          \`;
        });
      } else {
        productsEl.innerHTML = 'No products found';
      }
      
      productsEl.classList.remove('loading');
    }
    
    // Load initial data
    refreshStats();
    loadProducts();
  </script>
</body>
</html>
`;

// Serve the fallback page at root
app.get('/', (req, res) => {
  res.send(fallbackHtml);
});

// No-cache middleware
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Serve static files
app.use(express.static(publicPath, {
  // Ensure we're not serving cached content
  etag: false,
  lastModified: false
}));

// SPA handler for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.send(fallbackHtml);
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Visit http://localhost:${PORT}/ to view the application`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
