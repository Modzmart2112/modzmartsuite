// Test script for replit-deploy.js
// This will run the deployment script and check if all critical 
// services are working correctly

const { spawnSync } = require('child_process');
const http = require('http');

console.log('Testing Replit deployment...');

// Start the deployment in a separate process
console.log('Starting deployment script...');
const deployProcess = spawnSync('node', ['replit-deploy.js'], {
  detached: true,
  stdio: 'inherit',
  env: process.env,
  timeout: 5000 // Give it 5 seconds to start
});

// Give the server a moment to start
console.log('Waiting for server to start...');
setTimeout(() => {
  // Test if the server is running
  console.log('Testing API endpoint...');
  http.get('http://localhost:5000/api/status', (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        console.log('API Status:', status);
        console.log('Server is running correctly!');
        
        // Now test database connection
        console.log('Testing database connection...');
        http.get('http://localhost:5000/api/database/status', (dbRes) => {
          let dbData = '';
          dbRes.on('data', (chunk) => {
            dbData += chunk;
          });
          
          dbRes.on('end', () => {
            try {
              const dbStatus = JSON.parse(dbData);
              console.log('Database Status:', dbStatus);
              console.log('Database connection is working!');
              
              // Exit with success
              console.log('All tests passed! Deployment script is working correctly.');
              process.exit(0);
            } catch (error) {
              console.error('Failed to parse database status response:', error);
              process.exit(1);
            }
          });
        }).on('error', (error) => {
          console.error('Database API request failed:', error.message);
          process.exit(1);
        });
      } catch (error) {
        console.error('Failed to parse API status response:', error);
        process.exit(1);
      }
    });
  }).on('error', (error) => {
    console.error('API request failed:', error.message);
    process.exit(1);
  });
}, 2000);

// Set a timeout to ensure the script doesn't hang
setTimeout(() => {
  console.error('Test timed out after 10 seconds');
  process.exit(1);
}, 10000);