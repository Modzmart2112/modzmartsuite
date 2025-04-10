const express = require('express');
const http = require('http');

// Create a simple Express app to test authentication
const app = express();
app.use(express.json());

// Set of authenticated tokens
const authenticatedTokens = new Set();

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Login attempt: username=${username}, password=${password}`);
    
    // Hardcoded credential check
    if (username === 'Admin' && password === 'Ttiinnyy1') {
      const token = Math.random().toString(36).substring(2, 15);
      authenticatedTokens.add(token);
      
      console.log(`Login successful! Generated token: ${token}`);
      
      return res.json({ 
        success: true, 
        token,
        user: { username } 
      });
    }
    
    console.log("Login failed: Invalid credentials");
    
    res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simple check that doesn't actually run the server
console.log("Auth test:");
console.log('- Username: Admin');
console.log('- Password: Ttiinnyy1');
console.log('These should match what simple-deploy.cjs is using');

// Check the auth code in simple-deploy.cjs
const fs = require('fs');
const deployContent = fs.readFileSync('./simple-deploy.cjs', 'utf8');
const authLines = deployContent.split('\n').filter(line => 
  line.includes('username ===') || line.includes('password ===')
);

console.log('\nAuthentication check in simple-deploy.cjs:');
authLines.forEach(line => console.log(line.trim()));
