import fs from 'fs';
import { promisify } from 'util';
import csvParser from 'csv-parser';
import { CsvRecord } from '@shared/types';

const readFile = promisify(fs.readFile);

export async function processCsvFile(filePath: string): Promise<CsvRecord[]> {
  const records: CsvRecord[] = [];
  
  return new Promise<CsvRecord[]>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data: any) => {
        console.log('CSV Row Data:', JSON.stringify(data));
        
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
          
          console.log(`Processed CSV row: SKU=${record.sku}, URL=${record.originUrl}`);
          records.push(record);
        } else {
          console.warn(`Skipping CSV row - missing SKU or Origin URL: ${JSON.stringify(data)}`);
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