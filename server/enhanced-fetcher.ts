import { ScrapedPriceResult } from "@shared/types";

/**
 * Enhanced price extraction using modern fetch techniques with proper headers
 * This function mimics browser requests to reliably extract prices from supplier websites
 */
export async function enhancedFetcher(url: string): Promise<ScrapedPriceResult> {
  // Extract SKU from URL
  let sku = url.split('/').pop() || '';
  // Clean the SKU (remove query params, etc.)
  if (sku && sku.includes('?')) {
    sku = sku.split('?')[0];
  }
  
  console.log(`Enhanced fetcher for URL: ${url}`);
  
  try {
    // Use full browser headers for better results
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`Successfully fetched HTML from ${url}, length: ${html.length} bytes`);
    
    // Store all potential prices we find with confidence levels
    const potentialPrices: Array<{value: number, source: string, confidence: number}> = [];
    
    // METHOD 1: Look for OpenGraph meta tags (most reliable if present)
    const ogPriceMatch = html.match(/<meta property="og:price:amount" content="([^"]+)">/i);
    if (ogPriceMatch && ogPriceMatch[1]) {
      const price = parseFloat(ogPriceMatch[1].replace(/,/g, ''));
      if (!isNaN(price) && price > 0) {
        console.log(`Found price in OpenGraph meta: $${price}`);
        potentialPrices.push({
          value: price,
          source: 'OpenGraph meta',
          confidence: 90 // Very high confidence
        });
      }
    }
    
    // METHOD 2: Look for Shopify product JSON data
    const shopifyProductJson = html.match(/var meta = ({[\s\S]*?product[\s\S]*?});/);
    if (shopifyProductJson && shopifyProductJson[1]) {
      try {
        // Try to extract price with regex instead of parsing potentially malformed JSON
        const priceMatch = shopifyProductJson[1].match(/"price":\s*(\d+(\.\d+)?)/);
        if (priceMatch && priceMatch[1]) {
          let price = parseFloat(priceMatch[1]);
          
          // Check if the price is in cents (Shopify often stores prices in cents)
          if (price > 1000) {
            const dollarPrice = price / 100;
            console.log(`Found price in Shopify meta (converted from cents): $${dollarPrice}`);
            potentialPrices.push({
              value: dollarPrice,
              source: 'Shopify meta (cents)',
              confidence: 85
            });
          } else {
            console.log(`Found price in Shopify meta: $${price}`);
            potentialPrices.push({
              value: price,
              source: 'Shopify meta',
              confidence: 85
            });
          }
        }
      } catch (e) {
        console.log('Error extracting Shopify product JSON:', e);
      }
    }
    
    // METHOD 3: Look for JSON-LD structured data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '');
          const jsonData = JSON.parse(jsonContent);
          
          // Check for product data
          if (jsonData && jsonData['@type'] === 'Product') {
            if (jsonData.offers) {
              const offers = Array.isArray(jsonData.offers) ? jsonData.offers : [jsonData.offers];
              
              for (const offer of offers) {
                if (offer.price) {
                  const price = parseFloat(offer.price);
                  if (!isNaN(price) && price > 0) {
                    console.log(`Found price in JSON-LD: $${price}`);
                    potentialPrices.push({
                      value: price,
                      source: 'JSON-LD',
                      confidence: 80
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.log('Error parsing JSON-LD:', e);
        }
      }
    }
    
    // METHOD 4: Look for visible price elements on the page
    const priceElements = [
      // Common Shopify price elements
      /<span[^>]*class="[^"]*price__current[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<div[^>]*class="[^"]*product-single__price[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      
      // ProSpeedRacing specific elements based on HTML inspection
      /<strong[^>]*class="[^"]*price__current[^"]*"[^>]*>([\s\S]*?)<\/strong>/i,
      /<div[^>]*class="[^"]*product-info__price[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];
    
    for (const regex of priceElements) {
      const match = html.match(regex);
      if (match && match[1]) {
        // Find price with dollar sign within the element
        const priceMatch = match[1].match(/\$\s*([\d,]+\.[0-9]{2})/);
        
        if (priceMatch && priceMatch[1]) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(price) && price > 0) {
            console.log(`Found price in visible element (${regex}): $${price}`);
            potentialPrices.push({
              value: price,
              source: 'Visible price element',
              confidence: 75 // Good confidence for visible elements
            });
          }
        }
      }
    }
    
    // METHOD 5: Check for direct price assignments in JavaScript
    const jsPriceAssignments = [
      /ShopifyAnalytics\.meta\.price\s*=\s*([0-9.]+)/i,
      /product\.price\s*=\s*([0-9.]+)/i,
      /"price":\s*([0-9.]+)/i
    ];
    
    for (const regex of jsPriceAssignments) {
      const match = html.match(regex);
      if (match && match[1]) {
        const price = parseFloat(match[1]);
        if (!isNaN(price) && price > 0) {
          // Check if price is likely in cents
          let finalPrice = price;
          if (price > 1000 && !url.includes('luxury') && !url.includes('premium')) {
            finalPrice = price / 100;
            console.log(`Found price in JS (converted from cents): $${finalPrice}`);
          } else {
            console.log(`Found price in JS: $${price}`);
          }
          
          potentialPrices.push({
            value: finalPrice,
            source: 'JavaScript',
            confidence: 70
          });
        }
      }
    }
    
    // METHOD 6: Look for any price pattern in the entire document
    const allPriceMatches = html.match(/\$\s*([\d,]+\.[0-9]{2})/g);
    if (allPriceMatches && allPriceMatches.length > 0) {
      // Create a frequency map
      const priceFrequency: Record<string, number> = {};
      
      for (const priceStr of allPriceMatches) {
        const match = priceStr.match(/\$\s*([\d,]+\.[0-9]{2})/);
        if (match && match[1]) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(price) && price > 0) {
            const key = price.toFixed(2);
            priceFrequency[key] = (priceFrequency[key] || 0) + 1;
          }
        }
      }
      
      // Find the most frequent price
      let maxCount = 0;
      let mostFrequentPrice = 0;
      
      for (const [priceStr, count] of Object.entries(priceFrequency)) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentPrice = parseFloat(priceStr);
        }
      }
      
      if (mostFrequentPrice > 0) {
        console.log(`Found most frequent price in document: $${mostFrequentPrice} (appears ${maxCount} times)`);
        potentialPrices.push({
          value: mostFrequentPrice,
          source: 'Most frequent price',
          confidence: 60
        });
      }
    }
    
    // If we have potential prices, return the one with highest confidence
    if (potentialPrices.length > 0) {
      console.log(`Found ${potentialPrices.length} potential prices`);
      
      // Sort by confidence
      potentialPrices.sort((a, b) => b.confidence - a.confidence);
      
      // If multiple prices have the same highest confidence,
      // they might be different formats of the same price or sale vs. regular price
      const highestConfidence = potentialPrices[0].confidence;
      const highConfidencePrices = potentialPrices.filter(p => p.confidence === highestConfidence);
      
      if (highConfidencePrices.length > 1) {
        // In case of a tie, use the highest price value (likely the non-discounted "regular" price)
        highConfidencePrices.sort((a, b) => b.value - a.value);
      }
      
      const bestPrice = highConfidencePrices[0].value;
      console.log(`Using price $${bestPrice} from ${highConfidencePrices[0].source} with confidence ${highConfidencePrices[0].confidence}`);
      
      return {
        sku,
        url,
        price: bestPrice,
        htmlSample: `Price $${bestPrice} from ${highConfidencePrices[0].source}`,
        note: `Price extracted using enhanced fetcher (${highConfidencePrices[0].source})`
      };
    }
    
    // If we couldn't extract any prices, return null with error
    console.error(`Failed to extract price for ${url} after trying multiple methods`);
    return {
      sku,
      url,
      price: null,
      error: "Failed to extract price after multiple extraction attempts",
      htmlSample: html.substring(0, 500),
      note: "No price found in any known format"
    };
    
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return {
      sku,
      url,
      price: null,
      error: (error as Error).message,
      note: "Error occurred while fetching supplier page"
    };
  }
}