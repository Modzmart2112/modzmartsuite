// Production server starter
// Uses dynamic import to handle ES modules correctly

console.log('Starting production server...');

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Import main app using dynamic import
import('./index.js')
  .then(module => {
    // Get the default export (setupApp function)
    const setupApp = module.default;
    
    // Run the setup function to get the server
    return setupApp();
  })
  .then(server => {
    // Start the server
    const port = parseInt(process.env.PORT);
    server.listen({port, host: '0.0.0.0'}, () => {
      console.log(`✅ Server running in production mode on port ${port}`);
      console.log('✅ Health check available at / (root URL)');
      console.log('✅ Application available at /dashboard and /login');
    });
  })
  .catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });