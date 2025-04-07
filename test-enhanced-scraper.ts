import { scrapePriceFromUrl } from './server/scraper';
async function testScraper() {
  console.log('Testing enhanced scraper...');
  const url = 'https://www.prospeedracing.com.au/products/apr-performance-gtc-200-2-5-riser-evo-8-evo-9-evo-x-mustang-s197-subaru-wrx-aa-100228';
  try {
    const result = await scrapePriceFromUrl(url);
    console.log('Scraper result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Scraper error:', error);
  }
}
testScraper();
