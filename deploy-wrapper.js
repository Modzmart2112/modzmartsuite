
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('Starting application in production mode...');

try {
  // Explicitly verify all required environment variables
  const requiredEnvVars = [
    'SHOPIFY_ACCESS_TOKEN',
    'SHOPIFY_API_KEY',
    'SHOPIFY_STORE_URL'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  // Validate access token format
  if (!process.env.SHOPIFY_ACCESS_TOKEN.startsWith('shpat_')) {
    console.error('Invalid Shopify access token format. Token should start with "shpat_"');
    process.exit(1);
  }

  // Normalize Shopify store URL
  let storeUrl = process.env.SHOPIFY_STORE_URL;
  if (!storeUrl.includes('myshopify.com')) {
    storeUrl += '.myshopify.com';
  }
  if (!storeUrl.startsWith('https://')) {
    storeUrl = `https://${storeUrl}`;
  }
  process.env.SHOPIFY_STORE_URL = storeUrl;

  // Import and setup app
  const { default: setupApp } = await import('./dist/index.js');
  const app = await setupApp();
  
  // Start server
  const port = process.env.PORT || 5000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });

  // Handle shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM - shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

} catch (error) {
  console.error('Application startup error:', error);
  process.exit(1);
}
