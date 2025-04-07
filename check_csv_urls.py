import csv
import sys

def analyze_csv(filepath):
    print(f"\nAnalyzing: {filepath}")
    
    # Open the CSV file
    with open(filepath, 'r', encoding='utf-8') as file:
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
        
        if missing_url_skus and len(missing_url_skus) < 10:
            print("\nSKUs missing URLs:")
            for i, sku in enumerate(missing_url_skus, 1):
                print(f"{i}. {sku}")
        elif missing_url_skus:
            print(f"\nFound {len(missing_url_skus)} SKUs missing URLs (too many to list)")
        
        return {
            'total': total_rows,
            'with_skus': rows_with_skus,
            'with_urls': rows_with_urls,
            'with_both': rows_with_both
        }

# Process all CSV files
apr_stats = analyze_csv('attached_assets/processed_APR Performance BAI 1.csv')
artec_stats = analyze_csv('attached_assets/processed_ARTEC BAI 1.csv')
bilstein_stats = analyze_csv('attached_assets/processed_Bilstein BAI 1.csv')

# Calculate totals
total_records = apr_stats['total'] + artec_stats['total'] + bilstein_stats['total']
total_with_skus = apr_stats['with_skus'] + artec_stats['with_skus'] + bilstein_stats['with_skus']
total_with_urls = apr_stats['with_urls'] + artec_stats['with_urls'] + bilstein_stats['with_urls']
total_with_both = apr_stats['with_both'] + artec_stats['with_both'] + bilstein_stats['with_both']

print("\n=== SUMMARY ===")
print(f"Total records across all CSVs: {total_records}")
print(f"Total records with SKUs: {total_with_skus}")
print(f"Total records with URLs: {total_with_urls}")
print(f"Total records with both SKU and URL: {total_with_both}")