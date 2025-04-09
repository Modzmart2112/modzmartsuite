#!/usr/bin/env node

// This wrapper script is designed to run the application
// in production mode by setting NODE_ENV and loading the dist/index.js file.
// It handles errors that might cause deployment failures.

process.env.NODE_ENV = 'production';

console.log('Starting application in production mode...');
console.log('Node version:', process.version);
console.log('ESM import using wrapper...');

import('./dist/index.js')
  .then(() => {
    console.log('Application loaded successfully!');
  })
  .catch(err => {
    console.error('Failed to load application:');
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  });