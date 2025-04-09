// Simple deployment test file that uses port 5001 instead of 5000
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production mode
process.env.NODE_ENV = 'production';

console.log('Starting test server on port 5001');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);

// Create Express app
const app = express();

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic API health endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    mode: 'test-deployment',
    serverTime: new Date().toISOString() 
  });
});

// Start the server on port 5001
const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});