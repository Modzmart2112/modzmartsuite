/**
 * MINIMAL HEALTH CHECK SERVER FOR REPLIT (CommonJS Version)
 * 
 * This is an ultra-minimal server with the bare minimum code needed
 * to pass Replit's deployment requirements:
 * 
 * 1. Start within 20 seconds
 * 2. Listen on port 5000
 * 3. Bind to 0.0.0.0
 * 4. Respond to health checks at /
 */

// Import minimal Express
const express = require('express');
const app = express();

// Set port (Replit expects 5000)
const PORT = process.env.PORT || 5000;

// Health check endpoint - responds with 200 OK
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Bind to 0.0.0.0 (required for Replit)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server running on port ${PORT}`);
  console.log('Deployment should now succeed');
});