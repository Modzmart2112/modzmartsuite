/**
 * Direct Render Deployment Script
 * Serves application exactly as built, just adjusts for Render's requirements
 */

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Configuration
const PORT = process.env.PORT || 10000;
process.env.NODE_ENV = 'production';

// Initialize path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express server
const app = express();
app.use(express.json());

console.log('Starting Direct Render Deployment');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Try to load the actual application
try {
  console.log('Attempting to load application from dist/index.js');
  
  // Import the built application
  import('./dist/index.js')
    .then(module => {
      console.log('Successfully loaded application from dist/index.js');
    })
    .catch(err => {
      console.error('Error loading application:', err);
      console.log('Falling back to static file server');
      
      // Serve static files as fallback
      const publicPath = path.join(__dirname, 'dist', 'public');
      console.log(`Serving static files from: ${publicPath}`);
      app.use(express.static(publicPath));
      
      // Handle SPA routes
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'API endpoint not found' });
        }
        
        res.sendFile(path.join(publicPath, 'index.html'));
      });
    });
} catch (err) {
  console.error('Error importing application:', err);
  console.log('Falling back to static file server');
  
  // Serve static files as fallback
  const publicPath = path.join(__dirname, 'dist', 'public');
  console.log(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));
  
  // Handle SPA routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
