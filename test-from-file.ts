import * as fs from 'fs';
import * as path from 'path';

// This is a simplified version of our scraping logic to test against the provided HTML file
function extractPriceFromHTML(html: string): number | null {
  console.log("Only extracting the displayed price on the page, no fallbacks");
      
  // For ProSpeedRacing, the main visible price is usually in the price__current element
  const priceCurrentContent = html.match(/<strong\s+class="price__current"[^>]*>([\s\S]*?)<\/strong>/i);
  
  if (priceCurrentContent && priceCurrentContent[1]) {
    console.log("Found price__current element:", priceCurrentContent[1].substring(0, 100).trim());
    
    // Find the first dollar amount
    const dollarMatch = priceCurrentContent[1].match(/\$\s*([\d,\.]+)/);
    
    if (dollarMatch && dollarMatch[1]) {
      const rawPriceStr = dollarMatch[1].trim();
      console.log(`Found visible price on page: "$${rawPriceStr}"`);
      
      // Remove any commas from the price
      const cleanPriceStr = rawPriceStr.replace(/,/g, '');
      const price = parseFloat(cleanPriceStr);
      
      if (!isNaN(price) && price > 0) {
        console.log(`Successfully parsed visible price: ${price} (original: $${rawPriceStr})`);
        return price;
      }
    }
  }
  
  return null;
}

async function testFromFile() {
  try {
    console.log("Testing price extraction from HTML file");
    
    // Read the HTML file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Pasted--body-class-product-cm-desktop-cm-body-cm-product-dom-loaded-dom-loaded-plus-6-div-tabindex-1743995706938.txt');
    const html = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Read ${html.length} bytes from file`);
    
    // Extract the price
    const price = extractPriceFromHTML(html);
    
    console.log("Extraction result:");
    console.log(price);
  } catch (error) {
    console.error("Error testing extraction:", error);
  }
}

testFromFile();