import puppeteer from 'puppeteer';

async function getPriceWithJavaScript(url: string) {
  console.log(`Testing puppeteer scraper for: ${url}`);
  
  // Check if puppeteer is available
  try {
    puppeteer;
    console.log('Puppeteer is available');
  } catch (e) {
    console.error('Puppeteer is not available:', e);
    return;
  }
  
  let browser;
  try {
    console.log('Launching puppeteer...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas'
      ]
    });
    
    console.log('Opening page...');
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('Extracting price...');
    const price = await page.evaluate(() => {
      // Try various price selectors
      const selectors = [
        '.price__current',
        '.price-item--regular',
        '.product__price .price',
        '.price',
        '[itemprop="price"]',
        '.product-single__price'
      ];
      
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const match = el.textContent.match(/\$\s*([\d,]+\.\d{2})/);
          if (match && match[1]) {
            return parseFloat(match[1].replace(/,/g, ''));
          }
        }
      }
      
      // Look for any price pattern in text
      const allText = document.body.innerText;
      const priceMatches = allText.match(/\$\s*([\d,]+\.\d{2})/g);
      if (priceMatches && priceMatches.length > 0) {
        // Extract first price
        const firstMatch = priceMatches[0].match(/\$\s*([\d,]+\.\d{2})/);
        if (firstMatch && firstMatch[1]) {
          return parseFloat(firstMatch[1].replace(/,/g, ''));
        }
      }
      
      return null;
    });
    
    console.log(`Price found: ${price}`);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'screenshot.png' });
    console.log('Screenshot saved as screenshot.png');
    
    return price;
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
const url = 'https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-wind-splitter-w-rods-subaru-wrx-sti-va-18-21-w-oem-sti-front-lip-cw-801808';
getPriceWithJavaScript(url)
  .then(price => console.log(`Final price result: $${price}`))
  .catch(err => console.error('Final error:', err));