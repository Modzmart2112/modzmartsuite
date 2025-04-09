
import { createServer } from 'http';
import express from 'express';

console.log('Starting application in production mode...');

try {
  const { default: setupApp } = await import('./dist/index.js');
  const app = await setupApp();
  
  const port = process.env.PORT || 5000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });

  // Handle shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM - shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

} catch (error) {
  console.error('Application startup error:', error);
  process.exit(1);
}
