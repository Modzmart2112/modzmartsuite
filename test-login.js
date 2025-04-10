const fetch = require('node-fetch');

async function testLogin() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'Admin',
        password: 'Ttiinnyy1'
      })
    });
    
    const data = await response.json();
    console.log("Login response:", data);
    
    if (data.success && data.token) {
      console.log("Login successful, testing products endpoint...");
      
      const productsResponse = await fetch('http://localhost:3000/api/products', {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      
      const productsData = await productsResponse.json();
      console.log("Products response:", 
        productsData.products ? 
        `Received ${productsData.products.length} products` : 
        "No products received");
      
      if (productsData.products && productsData.products.length > 0) {
        console.log("First product:", productsData.products[0]);
      }
    }
  } catch (error) {
    console.error("Error testing login:", error.message);
  }
}

testLogin();
