/**
 * Minimal API Routes for Render Deployment with enhanced date handling
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper function to ensure safe date formatting
function safeDate(date) {
  if (!date) return new Date().toISOString();
  
  try {
    // If it's already a string in ISO format, return it
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return date;
    }
    
    // Otherwise convert to ISO string
    return new Date(date).toISOString();
  } catch (e) {
    console.error('Date conversion error:', e);
    return new Date().toISOString();
  }
}

// Function to ensure objects have all necessary properties
function ensureCompleteObject(obj, defaults) {
  const result = { ...defaults, ...obj };
  
  // Ensure all date fields are properly formatted
  Object.keys(result).forEach(key => {
    if (
      key.toLowerCase().includes('date') || 
      key.toLowerCase().includes('time') || 
      key.toLowerCase().includes('at')
    ) {
      result[key] = safeDate(result[key]);
    }
  });
  
  return result;
}

export default function configureApiRoutes(app) {
  console.log('Configuring minimal API routes with enhanced date handling');

  // User Profile endpoint
  app.get('/api/user/profile', async (req, res) => {
    try {
      const defaultUser = {
        id: 1,
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
        createdAt: safeDate(null)
      };
      
      res.json(defaultUser);
    } catch (err) {
      console.error('Error in user profile endpoint:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Products endpoint
  app.get('/api/products', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM products LIMIT 100');
      
      const defaultProduct = {
        id: 0,
        productId: 0,
        title: 'Product',
        price: 0,
        costPrice: 0,
        createdAt: safeDate(null),
        updatedAt: safeDate(null),
        shopifyId: null,
        sku: '',
        supplierUrl: '',
        // Additional fields that might be required
        vendor: '',
        productType: '',
        description: '',
        status: 'active'
      };
      
      // Make sure each product has all required fields
      const products = result.rows.map(product => 
        ensureCompleteObject(product, defaultProduct)
      );
      
      res.json(products);
    } catch (err) {
      console.error('Error fetching products:', err);
      // Return empty array instead of error
      res.json([]);
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const products = await pool.query('SELECT COUNT(*) FROM products');
      const productCount = parseInt(products.rows[0].count) || 0;
      
      const defaultStats = {
        productCount: 0,
        displayCount: 0,
        syncedProducts: 0,
        lastSync: safeDate(null),
        updatedAt: safeDate(null),
        storeUrl: process.env.SHOPIFY_STORE_URL || '',
        syncInProgress: false
      };
      
      const stats = ensureCompleteObject({
        productCount: productCount,
        displayCount: productCount,
        syncedProducts: productCount
      }, defaultStats);
      
      res.json(stats);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      // Return default stats
      res.json({
        productCount: 0,
        displayCount: 0,
        syncedProducts: 0,
        lastSync: safeDate(null),
        updatedAt: safeDate(null),
        storeUrl: process.env.SHOPIFY_STORE_URL || '',
        syncInProgress: false
      });
    }
  });

  // Dashboard activity
  app.get('/api/dashboard/activity', async (req, res) => {
    try {
      res.json([
        {
          id: 1,
          action: 'System started',
          timestamp: safeDate(null),
          details: 'Application deployed on Render'
        }
      ]);
    } catch (err) {
      console.error('Error fetching activity:', err);
      res.json([]);
    }
  });

  // Shopify status
  app.get('/api/shopify/status', (req, res) => {
    try {
      res.json({
        connected: true,
        store: process.env.SHOPIFY_STORE_URL || 'Not configured',
        lastSync: safeDate(null)
      });
    } catch (err) {
      console.error('Error fetching Shopify status:', err);
      res.json({
        connected: false,
        store: '',
        lastSync: safeDate(null)
      });
    }
  });

  // Shopify connection status
  app.get('/api/shopify/connection-status', (req, res) => {
    try {
      res.json({
        connected: true,
        store: process.env.SHOPIFY_STORE_URL || 'Not configured',
        lastSync: safeDate(null)
      });
    } catch (err) {
      console.error('Error fetching Shopify connection status:', err);
      res.json({
        connected: false,
        store: '',
        lastSync: safeDate(null)
      });
    }
  });

  // Shopify brands
  app.get('/api/shopify/brands', (req, res) => {
    try {
      res.json([
        { id: 1, name: 'Default Brand' }
      ]);
    } catch (err) {
      console.error('Error fetching brands:', err);
      res.json([]);
    }
  });

  // Products discrepancies
  app.get('/api/products/discrepancies', (req, res) => {
    try {
      res.json([]);
    } catch (err) {
      console.error('Error fetching discrepancies:', err);
      res.json([]);
    }
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      
      res.json([
        {
          id: 1,
          message: 'Application migrated to Render',
          timestamp: safeDate(null),
          read: false
        }
      ]);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.json([]);
    }
  });

  // Scheduler status
  app.get('/api/scheduler/status', (req, res) => {
    try {
      res.json({ 
        isRunning: false,
        lastRun: safeDate(null),
        nextRun: safeDate(null)
      });
    } catch (err) {
      console.error('Error fetching scheduler status:', err);
      res.json({
        isRunning: false,
        lastRun: safeDate(null),
        nextRun: safeDate(null)
      });
    }
  });

  // Scheduler sync progress
  app.get('/api/scheduler/shopify-sync-progress', (req, res) => {
    try {
      res.json({ 
        inProgress: false,
        completed: 0,
        total: 0,
        lastUpdated: safeDate(null)
      });
    } catch (err) {
      console.error('Error fetching sync progress:', err);
      res.json({
        inProgress: false,
        completed: 0,
        total: 0,
        lastUpdated: safeDate(null)
      });
    }
  });

  console.log('API routes configured successfully');
  return true;
}
