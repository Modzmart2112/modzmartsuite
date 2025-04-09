// deploy.js - Simple deployment entry point for Replit
// This file serves only the frontend portion of the application
// for demonstration purposes

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production mode
process.env.NODE_ENV = 'production';

console.log('Starting application in production mode via deploy.js');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);

// Create Express app
const app = express();

// Check if the static directory exists
const staticDir = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(staticDir)) {
  console.log(`Static directory found: ${staticDir}`);
} else {
  console.warn(`Static directory not found: ${staticDir}`);
}

// Serve static files from the frontend build
app.use(express.static(staticDir));

// Basic API health endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    mode: 'static-only',
    serverTime: new Date().toISOString() 
  });
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  const indexFile = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(500).send('Frontend build not found. Please run "npm run build" first.');
  }
});

// API 404 handler
app.use('/api/', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.path} not found in static-only mode`
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Static server running on port ${PORT}`);
});