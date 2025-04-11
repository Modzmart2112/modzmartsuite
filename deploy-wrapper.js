
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('Starting application in production mode...');

(async () => {
  try {
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

    if (!process.env.SHOPIFY_ACCESS_TOKEN.startsWith('shpat_')) {
      console.error('Invalid Shopify access token format. Token should start with "shpat_"');
      process.exit(1);
    }

    let storeUrl = process.env.SHOPIFY_STORE_URL;
    if (!storeUrl.includes('myshopify.com')) {
      storeUrl += '.myshopify.com';
    }
    if (!storeUrl.startsWith('https://')) {
      storeUrl = `https://${storeUrl}`;
    }
    process.env.SHOPIFY_STORE_URL = storeUrl;

    // ⬇️ This will now work correctly inside the async wrapper
    const { default: setupApp } = await import('./dist/index.js');
    const app = await setupApp();

    const port = process.env.PORT || 5000;
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
    });

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
})();

