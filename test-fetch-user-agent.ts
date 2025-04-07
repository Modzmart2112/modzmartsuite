import fetch from 'node-fetch';
import * as fs from 'fs';

async function getPriceWithAdvancedFetch(url: string) {
  console.log(`Testing advanced fetch for: ${url}`);
  
  try {
    // Using a modern browser User-Agent with proper headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`Fetched HTML: ${html.length} bytes`);
    
    // Save the HTML content to a file for inspection
    fs.writeFileSync('response.html', html);
    console.log('HTML content saved to response.html');
    
    // Check for JSON-LD product data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLdMatches) {
      console.log(`Found ${jsonLdMatches.length} JSON-LD script tags`);
      
      for (const match of jsonLdMatches) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
          const jsonData = JSON.parse(jsonContent);
          
          console.log('JSON-LD type:', jsonData['@type']);
          
          if (jsonData && jsonData['@type'] === 'Product' && jsonData.offers) {
            if (Array.isArray(jsonData.offers)) {
              console.log(`Found ${jsonData.offers.length} offers in JSON-LD`);
              if (jsonData.offers.length > 0 && jsonData.offers[0].price) {
                console.log(`Found price in JSON-LD array: $${jsonData.offers[0].price}`);
                return parseFloat(jsonData.offers[0].price);
              }
            } else if (jsonData.offers.price) {
              console.log(`Found price in JSON-LD: $${jsonData.offers.price}`);
              return parseFloat(jsonData.offers.price);
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      }
    }
    
    // Look for Shopify product meta data
    const shopifyMetaMatch = html.match(/var meta = (\{[\s\S]*?product[\s\S]*?\});\s*<\/script>/);
    if (shopifyMetaMatch && shopifyMetaMatch[1]) {
      try {
        // Clean the JSON before parsing
        const cleanedJson = shopifyMetaMatch[1]
          .replace(/\\"/g, '"')  // Replace escaped quotes
          .replace(/'/g, '"')    // Replace single quotes with double quotes
          .replace(/,\s*\}/g, '}'); // Remove trailing commas
          
        console.log('Found Shopify meta data, attempting to extract');
        
        // Let's try to extract the price directly using regex
        const priceMatch = shopifyMetaMatch[1].match(/"price":\s*(\d+(\.\d+)?)/);
        if (priceMatch && priceMatch[1]) {
          let price = parseFloat(priceMatch[1]);
          
          // Shopify sometimes stores price in cents instead of dollars
          // Check if the price seems unusually high and convert if needed
          if (price > 1000) {
            price = price / 100;
            console.log(`Found price in Shopify meta (converted from cents): $${price}`);
          } else {
            console.log(`Found price in Shopify meta: $${price}`);
          }
          
          return price;
        }
      } catch (e) {
        console.error('Error processing Shopify meta data:', e);
      }
    }
    
    // Look for Shopify window.ShopifyAnalytics object
    const windowAnalyticsMatch = html.match(/window\.ShopifyAnalytics[\s\S]*?meta[\s\S]*?price['"]\s*:\s*['"]*([0-9.]+)['"]*\s*,/);
    if (windowAnalyticsMatch && windowAnalyticsMatch[1]) {
      const price = parseFloat(windowAnalyticsMatch[1]);
      console.log(`Found price in ShopifyAnalytics meta: $${price}`);
      return price;
    }
    
    // Look for OpenGraph price meta tag
    const ogPriceMatch = html.match(/<meta property="og:price:amount" content="([^"]+)">/);
    if (ogPriceMatch && ogPriceMatch[1]) {
      const price = parseFloat(ogPriceMatch[1]);
      console.log(`Found price in OpenGraph meta tag: $${price}`);
      return price;
    }
    
    // Look for visible price elements
    const priceElements = [
      /<strong class="price__current"[^>]*>([\s\S]*?)<\/strong>/i,
      /<span class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<div class="[^"]*product-single__price[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<span class="[^"]*price__current[^"]*"[^>]*>([\s\S]*?)<\/span>/i
    ];
    
    for (const pattern of priceElements) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Look for dollar amount in the match
        const priceMatch = match[1].match(/\$\s*([\d,]+\.\d{2})/);
        if (priceMatch && priceMatch[1]) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          console.log(`Found price in HTML element: $${price}`);
          return price;
        }
      }
    }
    
    // Look for direct ShopifyAnalytics meta price
    const directAnalyticsMatch = html.match(/ShopifyAnalytics\.meta\.price\s*=\s*([0-9.]+)/i);
    if (directAnalyticsMatch && directAnalyticsMatch[1]) {
      const price = parseFloat(directAnalyticsMatch[1]);
      console.log(`Found price in ShopifyAnalytics.meta.price: $${price}`);
      return price;
    }
    
    // Look for any price in the HTML
    const anyPriceMatch = html.match(/\$\s*([\d,]+\.\d{2})/);
    if (anyPriceMatch && anyPriceMatch[1]) {
      const price = parseFloat(anyPriceMatch[1].replace(/,/g, ''));
      console.log(`Found general price in HTML: $${price}`);
      return price;
    }
    
    console.log('No price found');
    return null;
  } catch (error) {
    console.error('Error during scraping:', error);
    return null;
  }
}

// Run the test
// Example 1 - APR Performance carbon fiber front wind splitter
const url1 = 'https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-wind-splitter-w-rods-subaru-wrx-sti-va-18-21-w-oem-sti-front-lip-cw-801808';
// Example 2 - Artec Industries Jeep JK track bar bracket
const url2 = 'https://www.prospeedracing.com.au/products/artec-industries-jeep-jk-track-bar-bracket-lt-tbr';

// Use url2 for this test
const url = url2;
getPriceWithAdvancedFetch(url)
  .then(price => console.log(`Final price result: $${price}`))
  .catch(err => console.error('Final error:', err));