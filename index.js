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
  import('./dist/index.js').then(module => {
    // The exported default from server/index.ts is the setupApp function
    const setupApp = module.default;
    
    if (typeof setupApp === 'function') {
      // Call the setup function to get the server
      setupApp().then(server => {
        // Start the server on port 5000
        const port = process.env.PORT || 5000;
        server.listen({ port, host: "0.0.0.0" }, () => {
          console.log(`Server running on port ${port}`);
        });
      }).catch(err => {
        console.error('Failed to setup application:');
        console.error(err);
        startFallbackServer('Failed to setup application. Check logs for details.');
      });
    } else {
      console.error('Exported module does not contain a setupApp function');
      startFallbackServer('Invalid server module. Missing setup function.');
    }
  }).catch(err => {
    console.error('Failed to load bundled server:');
    console.error(err);
    startFallbackServer('Failed to load application. Check logs for details.');
  });
} else {
  console.error('Error: dist/index.js not found');
  startFallbackServer('Application build missing. Run "npm run build" first.');
}

// Helper function to start a fallback server
function startFallbackServer(errorMessage) {
  // Set up a basic fallback route to display error
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(500).json({ error: 'Server Error', message: errorMessage });
    }
    
    res.status(500).send(`
      <html>
        <head>
          <title>Server Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #e74c3c; }
            .error { background: #f8d7da; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Server Error</h1>
          <div class="error">
            <p>${errorMessage}</p>
          </div>
          <p>Please contact support if this issue persists.</p>
        </body>
      </html>
    `);
  });
  
  // Start listener on port 5000
  const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Fallback server running on port ${port}`);
  });
}