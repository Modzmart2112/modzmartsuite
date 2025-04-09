import { createServer } from 'http';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

console.log('Starting application in production mode...');

try {
  const { default: setupApp } = await import('./dist/index.js');
  const app = await setupApp();

  // Health check endpoint
  app.get('/', (req, res) => {
    res.status(200).send('Health check OK');
  });

  const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (error) => {
    console.error('Server startup error:', error);
    // Don't exit process on error. Log the error for debugging purposes.
    log(`Failed to start server: ${error.message}`);
  });

} catch (error) {
  console.error('Application initialization error:', error);
  process.exit(1);
}