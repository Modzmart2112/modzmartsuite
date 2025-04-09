// Ultra-minimal deployment script for Replit
// Focuses only on meeting deployment requirements
const express = require('express');
const path = require('path');

// Create Express app
const app = express();

// Log environment for debugging
console.log('Starting minimal deployment...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// Make sure we have access to important env vars
if (!process.env.PORT) {
  console.warn('PORT environment variable not defined, defaulting to 3000');
}

// Explicitly set content type for better compatibility
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  } else if (req.path.endsWith('.css')) {
    res.type('text/css');
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// All other routes serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Start the server - CRITICAL: Use process.env.PORT exactly as provided by Replit
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle termination gracefully
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});