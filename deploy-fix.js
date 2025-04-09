// This small file is meant to test why deployment is failing
// It loads the dist/index.js file using ES modules
// Run with: node deploy-fix.js

import('./dist/index.js').catch(err => {
  console.error('Error loading dist/index.js:');
  console.error(err);
});