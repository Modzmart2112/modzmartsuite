import puppeteer from 'puppeteer';
import { ScrapedPriceResult } from '@shared/types';

// Scrape price from a URL
export async function scrapePriceFromUrl(url: string): Promise<ScrapedPriceResult> {
  let browser = null;
  
  try {
    // Launch browser in headless mode
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to URL with timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Extract price using various common price selectors
    const priceSelectors = [
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
          priceText = await page.evaluate(el => el.textContent, element);
          if (priceText) break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
    
    // If no price found, try evaluating scripts for JSON-LD or other structured data
    if (!priceText) {
      try {
        priceText = await page.evaluate(() => {
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
    console.error(`Error scraping price from ${url}:`, error);
    return {
      sku: url.split('/').pop() || url,
      url,
      price: null,
      error: (error as Error).message || 'Failed to scrape price'
    };
  } finally {
    // Close browser
    if (browser) {
      await browser.close();
    }
  }
}
