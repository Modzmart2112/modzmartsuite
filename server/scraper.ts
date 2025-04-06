import { ScrapedPriceResult } from '@shared/types';
import { launch } from 'puppeteer';
import { join } from 'path';

// Utility function to get the path to the Chrome executable
function getChromiumPath(): string {
  try {
    // Default paths for different operating systems
    const defaultPaths = {
      linux: '/usr/bin/chromium-browser',
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
      headless: 'new',
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
    
    // Use regex patterns to find prices in the HTML
    const pricePatterns = [
      // Price with currency symbol
      /[₹$£€¥]?\s?(\d{1,3}(,\d{3})*(\.\d{2})?)([^\d]|$)/,
      // Price with currency code
      /(USD|EUR|GBP|INR|AUD|CAD)\s?(\d{1,3}(,\d{3})*(\.\d{2})?)([^\d]|$)/,
      // Structured data in JSON-LD
      /"price":\s*"?(\d{1,3}(,\d{3})*(\.\d{2})?)("|\s|,|$)/,
      // Generic price pattern
      /price"?\s*:?\s*"?(\d{1,3}(,\d{3})*(\.\d{2})?)("|\s|,|$)/i
    ];
    
    let priceText = null;
    
    // Try each pattern until we find a match
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        priceText = match[1].trim();
        break;
      }
    }
    
    if (!priceText) {
      throw new Error('No price found in the page content');
    }
    
    // Clean and parse the price
    priceText = priceText.replace(/[^\d.,]/g, '');
    priceText = priceText.replace(',', '.');
    const price = parseFloat(priceText);
    
    if (isNaN(price) || price <= 0) {
      throw new Error('Invalid price format');
    }
    
    return {
      sku: url.split('/').pop() || url,
      url,
      price
    };
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