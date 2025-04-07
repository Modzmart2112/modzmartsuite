import { scrapePriceFromUrl } from './server/scraper';
async function testScraper() {
  console.log('Testing enhanced scraper with user provided URL...');
  const url = 'https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-wind-splitter-w-rods-subaru-wrx-sti-va-18-21-w-oem-sti-front-lip-cw-801808';
  try {
    const result = await scrapePriceFromUrl(url);
    console.log('Scraper result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Scraper error:', error);
  }
}
testScraper();
