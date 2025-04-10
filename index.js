// Root level index.js for Replit Deployment
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production mode
process.env.NODE_ENV = 'production';

async function startServer() {
  try {
    // Import the setup function from dist/index.js
    const { default: setupApp } = await import('./dist/index.js');

    // Call the setup function to get the configured app
    const app = await setupApp();

    // Start listening
    const port = process.env.PORT || 5000;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running in production mode on port ${port}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer();