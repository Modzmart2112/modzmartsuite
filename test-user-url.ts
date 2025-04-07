import { enhancedPuppeteerScraper } from './server/scraper';
async function testDirectPuppeteer() {
  console.log('Testing direct Puppeteer scraper with user provided URL...');
  const url = 'https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-wind-splitter-w-rods-subaru-wrx-sti-va-18-21-w-oem-sti-front-lip-cw-801808';
  try {
    console.log('Running Puppeteer to get the JavaScript-rendered price...');
    const result = await enhancedPuppeteerScraper(url);
    console.log('Puppeteer result (with JavaScript rendering):', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Puppeteer error:', error);
  }
}
testDirectPuppeteer();
