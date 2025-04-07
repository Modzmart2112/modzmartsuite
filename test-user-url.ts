import { enhancedFetcher } from './server/enhanced-fetcher';

const url = process.argv[2] || 'https://www.prospeedracing.com.au/products/apr-performance-carbon-fibre-front-wind-splitter-w-rods-subaru-wrx-sti-va-18-21-w-oem-sti-front-lip-cw-801808';

if (!url) {
  console.error('Please provide a URL as an argument');
  process.exit(1);
}

console.log(`Testing price extraction from URL: ${url}`);

async function testDirectPuppeteer() {
  try {
    const result = await enhancedFetcher(url);
    
    console.log('\nRESULT:');
    console.log('======');
    console.log(`SKU: ${result.sku}`);
    console.log(`Price: $${result.price}`);
    console.log(`Note: ${result.note || 'N/A'}`);
    console.log(`Error: ${result.error || 'None'}`);
    
    if (result.price === null) {
      console.log('\nUnable to extract price from the URL.');
    } else {
      console.log(`\nSuccessfully extracted price: $${result.price} from the URL.`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectPuppeteer();