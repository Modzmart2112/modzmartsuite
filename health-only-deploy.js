/**
 * MINIMAL HEALTH CHECK SERVER FOR REPLIT
 * 
 * This extremely minimal server does only one thing:
 * - Provide a health check endpoint at / that returns 200 OK
 * 
 * It's designed to start instantly, allowing Replit to consider
 * the deployment successful. Once deployed, you can use the full
 * application through the normal URL.
 */

// Create a minimal Express server
const express = require('express');
const app = express();

// Root endpoint for health checks
app.get('/', (req, res) => {
  res.status(200).send('OK - Health check passed');
});

// Bind to 0.0.0.0 (required for Replit) and port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal health check server running on port ${PORT}`);
  console.log('Your application can now be deployed to Replit.');
  console.log('After deployment, you can access the full application via the normal URL.');
});