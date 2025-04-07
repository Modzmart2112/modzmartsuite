import { scrapePriceFromUrl } from './server/scraper';
import * as fs from 'fs';

async function testScraper() {
  try {
    // Add multiple URLs to test the scraper on different product pages
    const urls = [
      "https://www.prospeedracing.com.au/products/apr-performance-gtc-200-2-5-riser-evo-8-evo-9-evo-x-mustang-s197-subaru-wrx-aa-100228",
    ];
    
    for (const url of urls) {
      console.log("\n-------------------------------");
      console.log(`Testing scraper with URL: ${url}`);
      
      // First, fetch the raw HTML ourselves to analyze
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        console.log(`Manually fetched HTML size: ${html.length} bytes`);
        
        // Save the HTML for analysis
        fs.writeFileSync('manual_fetch.html', html);
        
        // Look for price__current elements to debug
        const priceCurrentRegex = /<strong\s+class="price__current"[^>]*>([\s\S]*?)<\/strong>/gi;
        let match;
        console.log("Direct price__current elements found in manual fetch:");
        let matchCount = 0;
        
        while ((match = priceCurrentRegex.exec(html)) !== null) {
          matchCount++;
          console.log(`Match ${matchCount}:`);
          console.log(`  Content: "${match[1]}"`);
          console.log(`  Full match: "${match[0].substring(0, 100)}..."`);
        }
        
        if (matchCount === 0) {
          console.log("  No direct price__current elements found");
        }
      }
      
      // Now run the actual scraper
      const result = await scrapePriceFromUrl(url);
      
      console.log("Scraping result:");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("Error testing scraper:", error);
  }
}

testScraper();