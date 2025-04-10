/**
 * Simple deployment script that just serves the built production files
 * This avoids the dual-start issue with the other scripts
 */

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an Express app
const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Health check endpoint
app.get('/', (req, res) => {
  // Check if it's a browser request
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('text/html')) {
    return res.redirect('/dashboard');
  }
  
  // For API requests, return health check
  res.status(200).json({
    status: 'healthy',
    message: 'Shopify Integration Service is running',
    timestamp: new Date().toISOString()
  });
});

// For all other routes, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Start the server
const port = process.env.PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running in production mode on port ${port}`);
  console.log('Health check is available at / (root)');
  console.log('Application is available at /dashboard and /login');
});