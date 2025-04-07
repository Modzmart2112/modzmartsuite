import fs from 'fs';
import path from 'path';
import { db } from './server/db';
import { storage } from './server/storage';
import { processCsvFile } from './server/csv-handler';
import { CsvRecord } from './shared/types';

const VENDOR_FILES = [
  'processed_ARTEC BAI 1.csv',
  'processed_Bilstein BAI 1.csv'
];

async function processVendorCsvs() {
  console.log('Starting vendor CSV processing...');
  
  for (const filename of VENDOR_FILES) {
    try {
      const filePath = path.join(process.cwd(), 'attached_assets', filename);
      console.log(`Processing ${filename}...`);
      
      // Check if file exists
      try {
        await fs.promises.access(filePath, fs.constants.F_OK);
      } catch (error) {
        console.error(`File ${filename} does not exist. Skipping.`);
        continue;
      }
      
      // Process CSV file
      const records = await processCsvFile(filePath);
      console.log(`Processed ${records.length} records from ${filename}`);
      
      // Create CSV upload record
      const csvUpload = await storage.createCsvUpload({
        filename: filename,
        recordsCount: records.length,
        processedCount: 0,
        status: 'pending'
      });
      
      console.log(`Created CSV upload record with ID ${csvUpload.id}`);
      
      // Process records
      let processedCount = 0;
      const updatedProductIds: number[] = [];
      
      for (const record of records) {
        // Check if product exists by SKU
        const product = await storage.getProductBySku(record.sku);
        
        if (product) {
          // Update supplier URL
          const updatedProduct = await storage.updateProduct(product.id, {
            supplierUrl: record.originUrl
          });
          
          console.log(`Updated product ${product.sku} with supplier URL: ${record.originUrl}`);
          
          if (updatedProduct && !updatedProductIds.includes(product.id)) {
            updatedProductIds.push(product.id);
          }
          
          processedCount++;
          
          // Update CSV upload status periodically
          if (processedCount % 10 === 0) {
            await storage.updateCsvUpload(csvUpload.id, {
              processedCount,
              status: 'processing'
            });
          }
        } else {
          console.log(`Product with SKU ${record.sku} not found in database. Skipping.`);
        }
      }
      
      // Update CSV upload status to completed
      await storage.updateCsvUpload(csvUpload.id, {
        processedCount,
        status: 'completed',
        updatedProductIds
      });
      
      console.log(`Completed processing ${filename}. Updated ${processedCount} products.`);
    } catch (error) {
      console.error(`Error processing ${filename}:`, error);
    }
  }
  
  console.log('Vendor CSV processing completed.');
}

// Run the function
processVendorCsvs()
  .then(() => {
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });