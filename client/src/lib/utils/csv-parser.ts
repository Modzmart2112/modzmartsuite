import { CsvRecord } from "@shared/types";

/**
 * Parses a CSV string into an array of records
 * @param content CSV content as string
 * @param options Optional parsing options
 * @returns Array of parsed CSV records
 */
export function parseCSV(
  content: string,
  options: {
    delimiter?: string;
    skipHeaderRow?: boolean;
    columns?: string[];
  } = {}
): CsvRecord[] {
  // Default options
  const delimiter = options.delimiter || ",";
  const skipHeaderRow = options.skipHeaderRow !== false;
  
  // Split content into lines
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return [];
  }
  
  // Determine columns
  let columns: string[];
  let startIndex = 0;
  
  if (options.columns) {
    // Use provided columns
    columns = options.columns;
  } else if (skipHeaderRow) {
    // Use first row as header
    columns = parseCSVLine(lines[0], delimiter);
    startIndex = 1;
  } else {
    // Generate generic column names (col0, col1, etc.)
    const firstLine = parseCSVLine(lines[0], delimiter);
    columns = firstLine.map((_, i) => `col${i}`);
  }
  
  // Parse rows into records
  const records: CsvRecord[] = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line, delimiter);
    const record: Record<string, string> = {};
    
    // Map values to columns
    for (let j = 0; j < Math.min(columns.length, values.length); j++) {
      record[columns[j]] = values[j];
    }
    
    // Standardize fields based on CsvRecord interface
    const csvRecord: CsvRecord = {
      sku: record.SKU || record.sku || "",
      originUrl: record["Origin URL"] || record.originUrl || record.url || "",
      title: record.Title || record.title || "",
      cost: record["Cost per item"] || record.cost || "",
      price: record.Price || record.price || "",
      description: record.Description || record.description || "",
    };
    
    // Add any remaining fields
    for (const key in record) {
      if (!Object.prototype.hasOwnProperty.call(csvRecord, key)) {
        (csvRecord as any)[key] = record[key];
      }
    }
    
    // Only add records with required fields
    if (csvRecord.sku && csvRecord.originUrl) {
      records.push(csvRecord);
    }
  }
  
  return records;
}

/**
 * Parse a single CSV line into an array of values, handling quoted values
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : "";
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quotes
        currentValue += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of value
      values.push(currentValue.trim());
      currentValue = "";
    } else {
      // Add to current value
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(currentValue.trim());
  
  return values;
}

/**
 * Read a CSV file and parse its contents
 * @param file File object to read
 * @returns Promise resolving to parsed CSV records
 */
export function readCSVFile(file: File): Promise<CsvRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const records = parseCSV(content);
        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Validates if a file is a valid CSV
 * @param file File to validate
 * @returns Promise resolving to validation result
 */
export function validateCSVFile(file: File): Promise<{
  valid: boolean;
  message?: string;
  recordCount?: number;
}> {
  return new Promise((resolve) => {
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      resolve({
        valid: false,
        message: "File must be a CSV file"
      });
      return;
    }
    
    // Read and validate content
    readCSVFile(file)
      .then(records => {
        if (records.length === 0) {
          resolve({
            valid: false,
            message: "CSV file is empty or has no valid records"
          });
          return;
        }
        
        // Get total record count from the file before SKU/URL filtering
        const totalRecords = records.length;
        
        // Check each record for required fields and count valid ones
        const validRecords = records.filter(record => record.sku && record.originUrl);
        const validRecordsCount = validRecords.length;
        
        // If no records have both SKU and Origin URL
        if (validRecordsCount === 0) {
          // Check which columns might be missing
          const hasSku = records.some(record => record.sku);
          const hasOriginUrl = records.some(record => record.originUrl);
          
          if (!hasSku && !hasOriginUrl) {
            resolve({
              valid: false,
              message: "CSV must contain both SKU and Origin URL columns"
            });
          } else if (!hasSku) {
            resolve({
              valid: false,
              message: "CSV is missing the SKU column"
            });
          } else if (!hasOriginUrl) {
            resolve({
              valid: false,
              message: "CSV is missing the Origin URL column"
            });
          } else {
            resolve({
              valid: false,
              message: "No records contain both SKU and Origin URL values"
            });
          }
          return;
        }
        
        // If some records are missing required fields, show a warning
        if (validRecordsCount < totalRecords) {
          resolve({
            valid: true,
            message: `${validRecordsCount} valid records found. ${totalRecords - validRecordsCount} rows will be ignored (missing SKU or Origin URL).`,
            recordCount: validRecordsCount
          });
          return;
        }
        
        resolve({
          valid: true,
          recordCount: validRecordsCount
        });
      })
      .catch(error => {
        resolve({
          valid: false,
          message: `Error parsing CSV: ${error.message}`
        });
      });
  });
}
