import { ScrapedPriceResult } from '@shared/types';
import { launch } from 'puppeteer';
import { join } from 'path';

// Utility function to get the path to the Chrome executable
function getChromiumPath(): string {
  try {
    // In Replit environment, Chromium is installed system-wide
    if (process.env.REPL_ID) {
      return '/nix/store/x205pbkd5xh5g4iv0x2hm2shayd25ci7-chromium-114.0.5735.198/bin/chromium';
    }
    
    // Default paths for different operating systems as fallback
    const defaultPaths = {
      linux: '/usr/bin/chromium',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    };
    
    // Get the platform-specific default path
    const platform = process.platform as keyof typeof defaultPaths;
    return defaultPaths[platform] || '';
  } catch (error) {
    console.error('Error determining Chromium path:', error);
    return '';
  }
}

// Main scraping function with multiple fallback mechanisms
export async function scrapePriceFromUrl(url: string): Promise<ScrapedPriceResult> {
  let browser = null;
  
  try {
    // Launch browser with appropriate configuration
    browser = await launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,1024'
      ],
      executablePath: getChromiumPath() || undefined
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to URL with timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract price using various common price selectors
    const priceSelectors = [
      '.price__current', // Added the selector from the example
      '.price', 
      '[data-price]', 
      '.product-price', 
      '.product__price',
      '.product-single__price',
      '[itemprop="price"]',
      '.woocommerce-Price-amount',
      '.regular-price',
      '.sale-price',
      '.current-price',
      'span.price',
      'div.price',
      '.product_price',
      '#product-price',
      '[data-product-price]'
    ];
    
    let priceText = '';
    
    for (const selector of priceSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => el.textContent, element);
          if (text) {
            priceText = text;
            break;
          }
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    // If no price found, try evaluating scripts for JSON-LD or other structured data
    if (!priceText) {
      try {
        const extractedText = await page.evaluate(() => {
          // Look for JSON-LD data
          const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
          if (jsonLdScript) {
            try {
              const jsonLd = JSON.parse(jsonLdScript.textContent || '{}');
              if (jsonLd.offers?.price) return jsonLd.offers.price;
              if (Array.isArray(jsonLd) && jsonLd[0]?.offers?.price) return jsonLd[0].offers.price;
            } catch (e) {
              // Continue if JSON parsing fails
            }
          }
          
          // Look for microdata
          const priceProps = document.querySelector('[itemprop="price"]');
          if (priceProps) return priceProps.getAttribute('content') || priceProps.textContent;
          
          // As a last resort, look for any text that looks like a price in the page
          const priceRegex = /[\$\£\€]?(\d+,?)+\.\d{2}/g;
          const textNodes = Array.from(document.querySelectorAll('body *'))
            .filter(el => el.children.length === 0 && el.textContent?.trim())
            .map(el => el.textContent?.trim())
            .filter(text => priceRegex.test(text || ''));
          
          return textNodes[0] || '';
        });
        
        if (extractedText) {
          priceText = extractedText;
        }
      } catch (error) {
        console.error('Error extracting price from scripts:', error);
      }
    }
    
    // Clean and parse the price
    let price: number | null = null;
    
    if (priceText) {
      // Remove currency symbols and non-numeric characters except decimal point
      priceText = priceText.trim().replace(/[^\d.,]/g, '');
      
      // Handle different decimal separators
      priceText = priceText.replace(',', '.');
      
      // Parse the price as a number
      price = parseFloat(priceText);
      
      // Validate price (must be a positive number)
      if (isNaN(price) || price <= 0) {
        price = null;
      }
    }
    
    return {
      sku: url.split('/').pop() || url,
      url,
      price
    };
  } catch (error) {
    console.error(`Error scraping price with Puppeteer from ${url}:`, error);
    
    // Attempt fallback with fetch-based approach
    console.log(`Attempting fallback fetch-based scraping for ${url}`);
    try {
      return await fetchBasedScraper(url);
    } catch (fetchError) {
      console.error(`Fallback scraping also failed for ${url}:`, fetchError);
      return {
        sku: url.split('/').pop() || url,
        url,
        price: null,
        error: (error as Error).message || 'Failed to scrape price with all methods'
      };
    }
  } finally {
    // Close browser
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

// Fallback scraper using fetch instead of Puppeteer
async function fetchBasedScraper(url: string): Promise<ScrapedPriceResult> {
  try {
    console.log(`Starting fetch-based scraping for ${url}`);
    
    // Fetch the page content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`Received HTML content for ${url} (${html.length} characters)`);
    
    // Look for the price__current class first (from the example)
    const priceCurrent = html.match(/<div class="price__default">[^<]*<strong class="price__current">[^<]*\$([0-9,]+\.[0-9]{2})<\/strong>/i);
    if (priceCurrent && priceCurrent[1]) {
      const price = parseFloat(priceCurrent[1].replace(/,/g, ''));
      console.log(`Found price__current match for ${url}: $${price}`);
      if (!isNaN(price) && price > 0) {
        return {
          sku: url.split('/').pop() || url,
          url,
          price
        };
      }
    }
    
    // Next try to find JSON-LD product data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    if (jsonLdMatch && jsonLdMatch[1]) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        if (jsonData.offers && jsonData.offers.price) {
          const price = parseFloat(jsonData.offers.price);
          console.log(`Found JSON-LD price for ${url}: $${price}`);
          if (!isNaN(price) && price > 0) {
            return {
              sku: url.split('/').pop() || url,
              url,
              price
            };
          }
        }
      } catch (e) {
        console.log(`Error parsing JSON-LD for ${url}: ${e}`);
      }
    }
    
    // Use regex patterns to find prices in the HTML
    const pricePatterns = [
      // Price with currency symbol - the most common pattern
      /[\$\£\€\¥]([0-9,]+\.[0-9]{2})/,
      // Variants with spaces
      /[\$\£\€\¥]\s*([0-9,]+\.[0-9]{2})/,
      // Price as a number in a data attribute
      /data-(?:product-)?price="([0-9.]+)"/,
      // Price in a structured format with currency code
      /"price":\s*"?([0-9.]+)"?/,
      // More general pattern
      /price"?\s*:?\s*"?([0-9.]+)"?/i
    ];
    
    // Try each pattern until we find a match
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        console.log(`Found price match (${pattern}) for ${url}: $${price}`);
        if (!isNaN(price) && price > 0) {
          return {
            sku: url.split('/').pop() || url,
            url,
            price
          };
        }
      }
    }
    
    // If we got here, try finding any number that looks like a price
    const anyPriceMatch = html.match(/\$\s*([0-9,]+\.[0-9]{2})/);
    if (anyPriceMatch && anyPriceMatch[1]) {
      const price = parseFloat(anyPriceMatch[1].replace(/,/g, ''));
      console.log(`Found general price match for ${url}: $${price}`);
      if (!isNaN(price) && price > 0) {
        return {
          sku: url.split('/').pop() || url,
          url,
          price
        };
      }
    }
    
    // Last resort: Log a small sample of the HTML for debugging
    console.log(`No price found for ${url}. HTML sample: ${html.substring(0, 500)}...`);
    throw new Error('No price found in the page content');
    
  } catch (error) {
    console.error(`Error in fetch-based scraper for ${url}:`, error);
    return {
      sku: url.split('/').pop() || url,
      url,
      price: null,
      error: (error as Error).message || 'Failed to scrape price with fetch method'
    };
  }
}