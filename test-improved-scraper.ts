import { scrapePriceFromUrl } from './server/scraper';

/**
 * Test our improved price scraper with real URLs
 */
async function testImprovedScraper() {
  console.log('Testing improved price scraper...');
  
  // Test URLs from the processed CSV files
  const testUrls = [
    'https://www.prospeedracing.com.au/products/artec-v1-3-5-cast-dump-front-pipe-4b11t-df-3-5v1',
    'https://www.prospeedracing.com.au/products/artec-t4-turbo-exhaust-manifold-atlas-4200-t4-ex',
    'https://www.prospeedracing.com.au/products/bilstein-b4-oe-replacement-shock-absorber-front-si-243953'
  ];
  
  console.log(`Testing ${testUrls.length} URLs...`);
  
  for (const url of testUrls) {
    try {
      console.log(`\n====== Testing URL: ${url} ======`);
      const result = await scrapePriceFromUrl(url);
      
      console.log('\nResult:');
      console.log('------');
      console.log(`SKU: ${result.sku}`);
      console.log(`Price: $${result.price}`);
      console.log(`Source: ${result.note || 'Not specified'}`);
      console.log(`Error: ${result.error || 'None'}`);
      console.log('------\n');
    } catch (error) {
      console.error(`Error testing URL ${url}:`, error);
    }
  }
}

// Run the test
testImprovedScraper().catch(console.error);