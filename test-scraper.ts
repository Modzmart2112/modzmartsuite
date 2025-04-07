import { scrapePriceFromUrl } from './server/scraper';

async function testScraper() {
  try {
    console.log("Testing scraper with URL:");
    console.log("https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-bumper-canards-toyota-supra-a90-91-20-23-ab-330902");
    
    const result = await scrapePriceFromUrl("https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-bumper-canards-toyota-supra-a90-91-20-23-ab-330902");
    
    console.log("Scraping result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error testing scraper:", error);
  }
}

testScraper();