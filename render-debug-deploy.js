/**
 * Minimal Render Deployment Script
 * Designed to work even with problematic application code
 */

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
const publicPath = path.join(__dirname, 'dist', 'public');

// Create Express server
const app = express();
app.use(express.json());

console.log('Starting Minimal Render Deployment');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Public path: ${publicPath}`);

// List files in dist directory
try {
  console.log('Listing files in dist directory:');
  const distFiles = fs.readdirSync(path.join(__dirname, 'dist'));
  console.log(distFiles);
  
  if (fs.existsSync(publicPath)) {
    console.log('Listing files in public directory:');
    const publicFiles = fs.readdirSync(publicPath);
    console.log(publicFiles);
  } else {
    console.log('Public directory does not exist!');
  }
} catch (err) {
  console.error('Error listing files:', err);
}

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'API is working' });
});

// Serve static files with absolute paths (no assumptions about directory structure)
if (fs.existsSync(publicPath)) {
  console.log(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));
} else {
  console.log('WARNING: Public directory does not exist, only serving API endpoints');
}

// Serve index.html for SPA routes if it exists
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(publicPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    console.log('Serving index.html for SPA route:', req.path);
    res.sendFile(indexPath);
  } else {
    console.log('WARNING: index.html does not exist, sending simple response');
    res.send(`
      <html>
        <head><title>MODZ Suite</title></head>
        <body>
          <h1>MODZ Suite</h1>
          <p>Application is running but index.html not found.</p>
          <p>Directory listing:</p>
          <pre>${JSON.stringify(fs.readdirSync(__dirname), null, 2)}</pre>
        </body>
      </html>
    `);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`API test endpoint: http://localhost:${PORT}/api/test`);
});
