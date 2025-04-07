import { storage } from './server/storage';
import fs from 'fs';
import csvParser from 'csv-parser';
import { pool } from './server/db';
import { eq, isNull, and, like } from 'drizzle-orm';
import { products } from './shared/schema';

// Define the CsvRecord interface here instead of importing
interface CsvRecord {
  sku: string;
  originUrl: string;
  title: string;
  cost: string;
  price: string;
  description: string;
  Vendor: string;
  'Product Type': string;
}

async function processCsvFile(filePath: string): Promise<CsvRecord[]> {
  const records: CsvRecord[] = [];
  
  return new Promise<CsvRecord[]>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data: any) => {
        // Check for SKU column variations
        const sku = data.SKU || data.sku || '';
        
        // Check for originUrl column variations
        const originUrl = data['Origin URL'] || data['origin_url'] || data.originUrl || '';
        
        // If we have both SKU and Origin URL, create a record
        if (sku && originUrl) {
          const record: CsvRecord = {
            sku,
            originUrl,
            title: data.Title || data.title || '',
            cost: data['Cost per item'] || data.cost || '',
            price: data.Price || data.price || '',
            description: data.Description || data.description || '',
            Vendor: data.Vendor || '',
            'Product Type': data['Product Type'] || ''
          };
          records.push(record);
        }
      })
      .on('end', () => {
        console.log(`CSV processing complete, found ${records.length} valid records`);
        resolve(records);
      })
      .on('error', (error) => {
        console.error('Error processing CSV:', error);
        reject(error);
      });
  });
}

async function fixMissingSupplierUrls() {
  try {
    console.log("Starting to fix missing supplier URLs for all vendor products...");
    
    // Define all CSV files to process
    const csvFiles = [
      './attached_assets/processed_APR Performance BAI 1.csv',
      './attached_assets/processed_ARTEC BAI 1.csv',
      './attached_assets/processed_Bilstein BAI 1.csv'
    ];
    
    // We've already imported the pool at the top of the file
    
    // Initialize total counters
    let totalFoundInCsv = 0;
    let totalUpdated = 0;
    
    // Process each CSV file
    for (const csvPath of csvFiles) {
      try {
        console.log(`\nProcessing ${csvPath}...`);
        const records = await processCsvFile(csvPath);
        totalFoundInCsv += records.length;
        console.log(`Found ${records.length} records in the CSV file`);
        
        // Keep track of updated records for this file
        let fileUpdateCount = 0;
        
        // Update products directly using SQL for better performance
        for (const record of records) {
          if (record.sku && record.originUrl) {
            // Use direct SQL to update
            const updateQuery = {
              text: 'UPDATE products SET supplier_url = $1 WHERE sku = $2 AND (supplier_url IS NULL OR supplier_url = \'\') RETURNING id, sku, title',
              values: [record.originUrl, record.sku]
            };
            
            const result = await pool.query(updateQuery);
            
            if (result.rowCount > 0) {
              const updatedProduct = result.rows[0];
              console.log(`Updated product ${updatedProduct.sku} (${updatedProduct.title}) with supplier URL: ${record.originUrl}`);
              fileUpdateCount++;
              totalUpdated++;
            }
          }
        }
        
        console.log(`Successfully updated ${fileUpdateCount} products from ${csvPath}`);
      } catch (error) {
        console.error(`Error processing ${csvPath}:`, error);
        // Continue with next file
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`- Total records found in CSV files: ${totalFoundInCsv}`);
    console.log(`- Total products updated with supplier URLs: ${totalUpdated}`);
    
    // Verify remaining products without supplier URLs
    const checkQuery = {
      text: 'SELECT COUNT(*) FROM products WHERE supplier_url IS NULL OR supplier_url = \'\'',
    };
    const checkResult = await pool.query(checkQuery);
    const remainingCount = parseInt(checkResult.rows[0].count);
    
    console.log(`- Remaining products without supplier URLs: ${remainingCount}`);
    
  } catch (error) {
    console.error("Error fixing supplier URLs:", error);
  }
}

// Run the function
fixMissingSupplierUrls().catch(console.error);