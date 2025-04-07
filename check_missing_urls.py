import csv

# Open the CSV file
with open('attached_assets/processed_APR Performance BAI 1.csv', 'r', encoding='utf-8') as file:
    # Create a CSV reader
    reader = csv.DictReader(file)
    
    # Count variables
    total_rows = 0
    rows_with_skus = 0
    rows_with_urls = 0
    rows_with_both = 0
    missing_url_skus = []
    
    # Process each row
    for row in reader:
        total_rows += 1
        
        sku = row.get('SKU', '').strip()
        url = row.get('Origin URL', '').strip()
        
        if sku:
            rows_with_skus += 1
        
        if url:
            rows_with_urls += 1
        
        if sku and url:
            rows_with_both += 1
        
        if sku and not url:
            missing_url_skus.append(sku)
    
    # Print results
    print(f"Total rows: {total_rows}")
    print(f"Rows with SKUs: {rows_with_skus}")
    print(f"Rows with URLs: {rows_with_urls}")
    print(f"Rows with both SKU and URL: {rows_with_both}")
    print(f"Rows with SKU but missing URL: {len(missing_url_skus)}")
    
    if missing_url_skus:
        print("\nSKUs missing URLs:")
        for i, sku in enumerate(missing_url_skus, 1):
            print(f"{i}. {sku}")