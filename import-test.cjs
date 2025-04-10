const fs = require('fs');
const path = require('path');

const filename = './database-export.json';

try {
  if (fs.existsSync(filename)) {
    console.log(`${filename} exists`);
    
    const stats = fs.statSync(filename);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    console.log("Successfully parsed file");
    
    console.log("Keys in the export:", Object.keys(data).join(', '));
    
    if (data.products) {
      console.log(`Found ${data.products.length} products in the export`);
      
      if (data.products.length > 0) {
        console.log("First product:");
        const product = data.products[0];
        console.log(`ID: ${product.id}, SKU: ${product.sku}, Title: ${product.title}`);
        console.log(`Fields: ${Object.keys(product).join(', ')}`);
      }
    }
    
    // Check stats, logs, and notifications
    ['stats', 'shopify_logs', 'notifications'].forEach(key => {
      if (data[key]) {
        console.log(`Found ${data[key].length} ${key} in the export`);
      } else {
        console.log(`No ${key} found in the export`);
      }
    });
    
  } else {
    console.error(`${filename} does not exist!`);
  }
} catch (error) {
  console.error("Error processing file:", error.message);
}
