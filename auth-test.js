// Import necessary modules
import express from 'express';
import { createServer } from 'http';

// Create a simple Express app to test authentication
const app = express();
app.use(express.json());

// Set of authenticated tokens
const authenticatedTokens = new Set();

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log("Login attempt:", { username, password });
    
    // Hardcoded credential check
    if (username === 'Admin' && password === 'Ttiinnyy1') {
      const token = Math.random().toString(36).substring(2, 15);
      authenticatedTokens.add(token);
      
      console.log("Login successful, generated token:", token);
      
      return res.json({ 
        success: true, 
        token,
        user: { username } 
      });
    }
    
    console.log("Login failed: invalid credentials");
    
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

// Start a test server
const PORT = 3333;
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log("You can test with:");
  console.log(`curl -X POST http://localhost:${PORT}/api/auth/login -H "Content-Type: application/json" -d '{"username":"Admin","password":"Ttiinnyy1"}'`);
  
  // Automatically close after 2 seconds
  setTimeout(() => {
    console.log("Auto-closing test server");
    server.close();
  }, 2000);
});
