/**
 * Production Server Entry Point
 * 
 * This file serves as the entry point for the application when running in production mode.
 * It sets environment variables and starts the server.
 */

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Import the index.js file using dynamic import
(async () => {
  try {
    console.log('Starting server in production mode...');
    
    // Load the application
    const { default: setupApp } = await import('./index.js');
    
    // Start the server
    const server = await setupApp();
    const port = process.env.PORT || 3000;
    
    server.listen({ port, host: "0.0.0.0" }, () => {
      console.log(`Server running on port ${port}`);
      console.log('Health check is available at / (root)');
      console.log('Application is available at /dashboard and /login');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error(error.stack); // Print stack trace for better debugging
    process.exit(1);
  }
})();