import fetch from 'node-fetch';
import * as fs from 'fs';

const url = "https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-wind-splitter-w-rods-subaru-wrx-sti-va-18-21-w-oem-sti-front-lip-cw-801808";

async function testDirectOGExtraction() {
  console.log(`Testing direct extraction from: ${url}`);
  
  try {
    // Method 1: Using fetch with basic headers
    console.log("\nMethod 1: fetch with basic headers");
    const response1 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      }
    });
    
    if (!response1.ok) {
      throw new Error(`HTTP error! Status: ${response1.status}`);
    }
    
    const html1 = await response1.text();
    console.log(`Successfully fetched HTML, length: ${html1.length} bytes`);
    
    // Extract OpenGraph meta price
    const ogPriceMatch1 = html1.match(/<meta[^>]*property="og:price:amount"[^>]*content="([^"]+)"/i);
    if (ogPriceMatch1 && ogPriceMatch1[1]) {
      const rawPrice = ogPriceMatch1[1];
      console.log(`Raw OpenGraph price string: "${rawPrice}"`);
      
      // Convert the price string to a number
      const parsedPrice = parseFloat(rawPrice.replace(/,/g, ''));
      console.log(`Parsed OpenGraph price: ${parsedPrice}`);
      
      if (!isNaN(parsedPrice)) {
        console.log(`Successfully extracted price: $${parsedPrice}`);
      } else {
        console.log(`Failed to parse price from "${rawPrice}"`);
      }
    } else {
      console.log("No OpenGraph price meta tag found with first pattern");
      
      // Try alternative pattern
      const ogPriceMatch1Alt = html1.match(/<meta[^>]*og:price:amount[^>]*content="([^"]+)"/i);
      if (ogPriceMatch1Alt && ogPriceMatch1Alt[1]) {
        console.log(`Found with alternate pattern: ${ogPriceMatch1Alt[1]}`);
      } else {
        // Print any OpenGraph meta tags found
        const metaSection = html1.match(/<meta[^>]*og:[^>]*>/gi);
        if (metaSection) {
          console.log("Found meta tags:", metaSection.join('\n'));
        }
      }
    }
    
    // Method 2: Using curl (through Bash command via JavaScript)
    console.log("\nMethod 2: Command-line curl");
    // Read the file downloaded by curl in previous command
    try {
      const curlHtml = fs.readFileSync('downloaded_page.html', 'utf8');
      console.log(`Read HTML file, length: ${curlHtml.length} bytes`);
      
      // Extract OpenGraph meta price
      const priceTagLine = curlHtml.match(/.*og:price:amount.*content="([^"]+)".*/i);
      if (priceTagLine) {
        console.log("Found price tag line:", priceTagLine[0]);
        
        const ogPriceMatch2 = priceTagLine[0].match(/content="([^"]+)"/i);
        if (ogPriceMatch2 && ogPriceMatch2[1]) {
          const rawPrice = ogPriceMatch2[1];
          console.log(`Raw price string from curl: "${rawPrice}"`);
          
          // Convert the price string to a number
          const parsedPrice = parseFloat(rawPrice.replace(/,/g, ''));
          console.log(`Parsed price from curl: ${parsedPrice}`);
        }
      } else {
        console.log("Price tag not found in curl output");
      }
      
    } catch (err) {
      console.log("Error reading curl output file:", err);
    }
    
    // Final check: Logging of all price strings found in the document
    console.log("\nFinding all dollar amounts in the document:");
    const allPrices = html1.match(/\$\s*([0-9,]+\.[0-9]{2})/g);
    if (allPrices) {
      console.log(`Found ${allPrices.length} price strings:`);
      const uniquePrices = new Set(allPrices);
      console.log("Unique prices:", [...uniquePrices]);
    } else {
      console.log("No dollar amount strings found in document");
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectOGExtraction();