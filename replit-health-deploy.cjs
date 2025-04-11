/**
 * ULTRA-MINIMAL HEALTH CHECK SERVER FOR REPLIT DEPLOYMENT
 * 
 * This is an ultra-minimal server with only what's needed to pass
 * Replit's startup time requirement (<20 seconds).
 * 
 * DO NOT ADD ANYTHING TO THIS FILE - it's designed to be as small and
 * fast as possible to ensure deployment succeeds.
 */

// Use HTTP module instead of Express for faster startup 
const http = require('http');

// Set port (Replit expects 5000)
const PORT = process.env.PORT || 5000;

// Create minimal HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Bind to 0.0.0.0 (required for Replit)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server running on port ${PORT}`);
  console.log('Deployment should now succeed');
});