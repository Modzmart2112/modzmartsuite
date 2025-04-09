
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import { log } from './server/vite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Node version:', process.version);
console.log('Starting application in production mode...');

// Import the built application
try {
  const app = express();
  
  // Health check endpoint
  app.get('/', (req, res) => {
    res.status(200).send('Health check OK');
  });

  // Import and initialize the main application
  const { default: initApp } = await import('./dist/index.js');
  await initApp(app);

  const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (error) => {
    console.error('Server startup error:', error);
    // Don't exit process on error
    log(`Failed to start server: ${error.message}`);
  });

} catch (error) {
  console.error('Application initialization error:', error);
  // Exit with non-13 code to prevent crash loop
  process.exit(1);
}
