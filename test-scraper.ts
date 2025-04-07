import { scrapePriceFromUrl } from './server/scraper';

async function testScraper() {
  try {
    // Add multiple URLs to test the scraper on different product pages
    const urls = [
      "https://www.prospeedracing.com.au/products/apr-performance-gtc-200-2-5-riser-evo-8-evo-9-evo-x-mustang-s197-subaru-wrx-aa-100228",
      "https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-bumper-canards-toyota-supra-a90-91-20-23-ab-330902",
      "https://www.prospeedracing.com.au/products/air-lift-performance-3p-3-8-digital-air-management-package-height-pressure-based-27702"
    ];
    
    for (const url of urls) {
      console.log("\n-------------------------------");
      console.log(`Testing scraper with URL: ${url}`);
      
      const result = await scrapePriceFromUrl(url);
      
      console.log("Scraping result:");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("Error testing scraper:", error);
  }
}

testScraper();