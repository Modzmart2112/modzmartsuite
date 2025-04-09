// Root level index.js for Replit Deployment
// This resolves the deployment issues by providing a clean entry point
// that properly loads the application in production mode

// Set environment to production
process.env.NODE_ENV = 'production';

// Import necessary modules - use ESM syntax since package.json has "type": "module"
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Serve static files from the dist/public directory
app.use(express.static(path.join(__dirname, 'dist/public')));

// Check if dist/index.js exists (bundled server code)
if (fs.existsSync(path.join(__dirname, 'dist', 'index.js'))) {
  console.log('Loading bundled server from dist/index.js');
  
  // Use dynamic import for the bundled ESM file
  import('./dist/index.js')
    .catch(err => {
      console.error('Failed to load bundled server:');
      console.error(err);
      
      // Set up a basic fallback route to display error
      app.get('*', (req, res) => {
        res.status(500).send(`
          <html>
            <head><title>Server Error</title></head>
            <body>
              <h1>Server Error</h1>
              <p>The application server failed to start. Please contact support.</p>
            </body>
          </html>
        `);
      });
      
      // Start listener on port 5000
      const port = process.env.PORT || 5000;
      app.listen(port, '0.0.0.0', () => {
        console.log(`Fallback server running on port ${port}`);
      });
    });
} else {
  console.error('Error: dist/index.js not found');
  
  // Create a simple fallback app
  app.get('*', (req, res) => {
    res.status(500).send(`
      <html>
        <head><title>Server Error</title></head>
        <body>
          <h1>Server Error</h1>
          <p>The application server failed to start. Please contact support.</p>
          <p>Error: dist/index.js not found - build may be missing.</p>
        </body>
      </html>
    `);
  });
  
  // Start listener on port 5000
  const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Emergency fallback server running on port ${port}`);
  });
}