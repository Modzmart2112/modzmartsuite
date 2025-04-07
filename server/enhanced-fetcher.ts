import { ScrapedPriceResult } from "@shared/types";

/**
 * Site-specific handlers for websites that require special treatment
 */
const siteSpecificHandlers: {
  [domain: string]: (url: string, html: string) => Promise<number | null>
} = {
  // ProSpeedRacing.com.au handler
  'prospeedracing.com.au': async (url: string, html: string): Promise<number | null> => {
    console.log("Applying ProSpeedRacing specific handler");
    
    // Try the most reliable approach first - direct curl request for the OpenGraph meta tag
    try {
      // We use dynamic import to avoid dependency issues if child_process is not available
      const { exec } = await import('child_process');
      
      return new Promise((resolve) => {
        // Direct command to extract just the OpenGraph meta tag - this is most reliable
        const ogCommand = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" "${url}" | grep -o '<meta property="og:price:amount" content="[^"]*"' | head -1`;
        
        exec(ogCommand, (error, stdout, stderr) => {
          if (error || !stdout.trim()) {
            console.log(`OpenGraph meta extraction failed, falling back to full HTML extraction`);
            // Use the full HTML extraction approach
            const fullHtmlCommand = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" "${url}"`;
            
            exec(fullHtmlCommand, (err2, html, stderr2) => {
              if (err2) {
                console.error(`Error executing full HTML curl: ${err2.message}`);
                return resolve(null);
              }
              
              // Extract price from OpenGraph meta tag in the full HTML
              const ogMatch = html.match(/<meta[^>]*property="og:price:amount"[^>]*content="([^"]+)"/i) ||
                              html.match(/content="([^"]+)"[^>]*property="og:price:amount"/i);
              
              if (ogMatch && ogMatch[1]) {
                const rawPrice = ogMatch[1];
                console.log(`Found price in full HTML response: ${rawPrice}`);
                
                const price = parseFloat(rawPrice.replace(/,/g, ''));
                if (!isNaN(price) && price > 0) {
                  console.log(`ProSpeedRacing special handler found price from full HTML: $${price}`);
                  return resolve(price);
                }
              }
              
              // If OpenGraph tag failed, try to find dollar amounts in the HTML
              const priceMatches = html.match(/\$\s*([0-9,]+\.[0-9]{2})/g);
              if (priceMatches && priceMatches.length > 0) {
                // Find all unique prices
                // Track unique prices using an object
                const uniquePrices: { [price: string]: number } = {};
                
                for (const priceText of priceMatches) {
                  const match = priceText.match(/\$\s*([0-9,]+\.[0-9]{2})/);
                  if (match && match[1]) {
                    const price = parseFloat(match[1].replace(/,/g, ''));
                    if (!isNaN(price) && price > 0) {
                      uniquePrices[price.toString()] = price;
                    }
                  }
                }
                
                const priceArray = Object.values(uniquePrices);
                console.log("Unique prices found:", priceArray);
                
                if (priceArray.length > 0) {
                  // Get the highest price (typically the regular price, not sale price)
                  const prices = priceArray.sort((a, b) => b - a);
                  console.log(`Using highest price: $${prices[0]}`);
                  return resolve(prices[0]);
                }
              }
              
              // Fallback to null if no price found
              return resolve(null);
            });
            
            return;
          }
          
          // We found an OpenGraph meta tag with the price
          const priceMatch = stdout.match(/content="([^"]+)"/);
          if (priceMatch && priceMatch[1]) {
            const rawPrice = priceMatch[1];
            console.log(`Found price in OpenGraph meta tag: ${rawPrice}`);
            
            const price = parseFloat(rawPrice.replace(/,/g, ''));
            if (!isNaN(price) && price > 0) {
              console.log(`ProSpeedRacing special handler found price: $${price}`);
              return resolve(price);
            }
          }
          
          // Fallback to null if regex matching failed
          return resolve(null);
        });
      });
    } catch (error) {
      console.error("Error in ProSpeedRacing special handler:", error);
      return null;
    }
  }
};

/**
 * Determines if a URL matches a site that needs special handling
 */
function findSiteSpecificHandler(url: string): ((url: string, html: string) => Promise<number | null>) | null {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  
  for (const domain of Object.keys(siteSpecificHandlers)) {
    if (hostname.includes(domain)) {
      return siteSpecificHandlers[domain];
    }
  }
  
  return null;
}

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
    // Check if we have a site-specific handler for this URL
    const siteHandler = findSiteSpecificHandler(url);
    if (siteHandler) {
      console.log("Using site-specific handler for this URL");
      
      // First fetch the HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.google.com/',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log(`Successfully fetched HTML from ${url}, length: ${html.length} bytes`);
      
      // Apply the site-specific handler
      const specialPrice = await siteHandler(url, html);
      if (specialPrice !== null) {
        console.log(`Site-specific handler returned price: $${specialPrice}`);
        return {
          sku,
          url, 
          price: specialPrice,
          htmlSample: `Price $${specialPrice} from site-specific handler`,
          note: `Price extracted using site-specific handler for this domain`
        };
      } else {
        console.log("Site-specific handler did not return a price, falling back to standard methods");
      }
    }
    
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
    console.log("Attempting to extract OpenGraph meta price...");
    
    // Try different patterns to account for different HTML structures
    const ogPricePatterns = [
      // Pattern 1: Standard og:price:amount meta tag
      /<meta[^>]*property="og:price:amount"[^>]*content="([^"]+)"[^>]*>/i,
      
      // Pattern 2: Reversed attribute order
      /<meta[^>]*content="([^"]+)"[^>]*property="og:price:amount"[^>]*>/i,
      
      // Pattern 3: With additional attributes in between
      /<meta[^>]*property="og:price:amount"[^>]*[^>]*content="([^"]+)"[^>]*>/i,
      
      // Pattern 4: More generic pattern to catch any variations
      /<meta[^>]*og:price:amount[^>]*content="([^"]+)"[^>]*>/i,
      
      // Pattern 5: Direct property match (fallback)
      /property="og:price:amount"[^>]*content="([^"]+)"/i
    ];
    
    let ogPrice = null;
    let rawPriceStr = '';
    
    for (const pattern of ogPricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        rawPriceStr = match[1];
        console.log(`Raw OpenGraph meta price string: "${rawPriceStr}" (matched with pattern ${pattern})`);
        
        // Ensure we handle prices with commas (e.g., "1,259.95")
        const cleanPriceStr = rawPriceStr.replace(/,/g, '');
        const price = parseFloat(cleanPriceStr);
        
        console.log(`Cleaned price string: "${cleanPriceStr}", parsed to number: ${price}`);
        
        if (!isNaN(price) && price > 0) {
          console.log(`Confirmed price in OpenGraph meta: $${price}`);
          ogPrice = price;
          potentialPrices.push({
            value: price,
            source: 'OpenGraph meta',
            confidence: 90 // Very high confidence
          });
          break; // Once we found a valid price, stop checking other patterns
        }
      }
    }
    
    if (!ogPrice) {
      console.log("No OpenGraph price meta tag found with any pattern");
      
      // Extract and print a sample of the meta tags for debugging
      const metaSample = html.match(/<meta[^>]*og:[^>]*>/gi);
      if (metaSample && metaSample.length > 0) {
        console.log("Found these OpenGraph meta tags:");
        metaSample.slice(0, 5).forEach(tag => console.log(` - ${tag}`));
        
        // Special handling for cases where the price is in a strange format
        const priceContent = metaSample.find(tag => tag.includes('og:price') || tag.includes('product:price'));
        if (priceContent) {
          console.log("Found a potential price meta tag:", priceContent);
          
          const contentMatch = priceContent.match(/content="([^"]+)"/i);
          if (contentMatch && contentMatch[1]) {
            const rawPrice = contentMatch[1];
            console.log(`Found price content: "${rawPrice}"`);
            
            const cleanPrice = rawPrice.replace(/,/g, '');
            const price = parseFloat(cleanPrice);
            
            if (!isNaN(price) && price > 0) {
              console.log(`Successfully extracted price from meta inspection: $${price}`);
              potentialPrices.push({
                value: price,
                source: 'OpenGraph meta (meta inspection)',
                confidence: 85
              });
            }
          }
        }
      } else {
        console.log("No OpenGraph meta tags found at all");
      }
    }
    
    // METHOD 2: Look for Shopify product JSON data
    const shopifyProductJson = html.match(/var meta = ({[\s\S]*?product[\s\S]*?});/);
    if (shopifyProductJson && shopifyProductJson[1]) {
      try {
        // Try to extract price with regex instead of parsing potentially malformed JSON
        // Include support for prices with commas
        const priceMatch = shopifyProductJson[1].match(/"price":\s*(?:")?([0-9,]+(?:\.[0-9]+)?)(?:")?/);
        if (priceMatch && priceMatch[1]) {
          // Remove commas before parsing
          let price = parseFloat(priceMatch[1].replace(/,/g, ''));
          
          console.log(`Found Shopify meta price: "${priceMatch[1]}", converted to: ${price}`);
          
          // Check if the price is in cents (Shopify often stores prices in cents)
          if (price > 1000 && !url.includes('luxury') && !url.includes('premium')) {
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
                  // Handle price value which might be a string with commas or a number
                  const priceStr = typeof offer.price === 'string' ? offer.price.replace(/,/g, '') : offer.price.toString();
                  const price = parseFloat(priceStr);
                  
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
      /ShopifyAnalytics\.meta\.price\s*=\s*"?([0-9,.]+)"?/i,
      /product\.price\s*=\s*"?([0-9,.]+)"?/i,
      /"price":\s*"?([0-9,.]+)"?/i,
      /Price:\s*"?\$?([0-9,.]+)"?/i
    ];
    
    for (const regex of jsPriceAssignments) {
      const match = html.match(regex);
      if (match && match[1]) {
        const price = parseFloat(match[1].replace(/,/g, ''));
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
    
    // METHOD 6: Look for Klaviyo price data (commonly used in Shopify stores)
    const klaviyoMatch = html.match(/Price:\s*"\$([0-9,.]+)"/i);
    if (klaviyoMatch && klaviyoMatch[1]) {
      const priceStr = klaviyoMatch[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      
      console.log(`Found Klaviyo price data: "${klaviyoMatch[1]}", converted to: ${price}`);
      
      if (!isNaN(price) && price > 0) {
        console.log(`Found valid price in Klaviyo data: $${price}`);
        potentialPrices.push({
          value: price,
          source: 'Klaviyo data',
          confidence: 85 // High confidence as this is usually accurate
        });
      }
    }
    
    // METHOD 7: Look for any price pattern in the entire document
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
        
        // Check frequency distribution to detect if this is a price on a category page
        // If the most frequent price appears much more often than others, it's likely not the product price
        const totalPrices = Object.values(priceFrequency).reduce((sum, count) => sum + count, 0);
        const percentOfTotal = (maxCount / totalPrices) * 100;
        
        console.log(`This price represents ${percentOfTotal.toFixed(1)}% of all price occurrences`);
        
        // Higher confidence if price doesn't appear too frequently
        const frequency_confidence = percentOfTotal > 50 ? 50 : 60;
        
        potentialPrices.push({
          value: mostFrequentPrice,
          source: 'Most frequent price',
          confidence: frequency_confidence
        });
      }
    }
    
    // If we have potential prices, return the one with highest confidence
    if (potentialPrices.length > 0) {
      console.log(`Found ${potentialPrices.length} potential prices`);
      
      // Sort by confidence
      potentialPrices.sort((a, b) => b.confidence - a.confidence);
      
      // Look for special case of ProSpeedRacing website
      if (url.includes('prospeedracing.com.au')) {
        console.log("Special handling for ProSpeedRacing website");
        
        // Try to extract the price from URL parameters first (the most reliable for this site)
        const urlParamsPriceMatch = url.match(/\?variant=([0-9]+)/);
        if (urlParamsPriceMatch) {
          const variantId = urlParamsPriceMatch[1];
          console.log(`Found variant ID: ${variantId}`);
          
          // Additional price extraction from the full HTML for ProSpeedRacing
          const frequentMatch = html.match(/\$\s*([0-9,]+\.[0-9]{2})/g);
          if (frequentMatch) {
            // Track unique prices using an object
            const uniquePrices: { [price: string]: number } = {};
            for (const priceText of frequentMatch) {
              const pMatch = priceText.match(/\$\s*([0-9,]+\.[0-9]{2})/);
              if (pMatch && pMatch[1]) {
                const price = parseFloat(pMatch[1].replace(/,/g, ''));
                if (!isNaN(price) && price > 0) {
                  uniquePrices[price.toString()] = price;
                }
              }
            }
            
            const priceArray = Object.values(uniquePrices);
            console.log("Unique prices found on page:", priceArray);
            
            // If there's a clear highest price, it's likely the non-sale price
            if (priceArray.length > 1) {
              const prices = priceArray.sort((a, b) => b - a);
              console.log(`Multiple prices detected, using highest: $${prices[0]}`);
              
              return {
                sku,
                url,
                price: prices[0],
                htmlSample: `Highest price $${prices[0]} from ProSpeedRacing special handler`,
                note: `Price extracted using enhanced fetcher (ProSpeedRacing special handler)`
              };
            }
          }
        }
      }
      
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