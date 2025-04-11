#!/bin/bash

# Replace all remaining fetch calls in shopify.ts with safeFetch
sed -i 's/\(\s\+\)response = await fetch(/\1response = await safeFetch(/g' server/shopify.ts
sed -i 's/\(\s\+\)inventoryResponse = await fetch(/\1inventoryResponse = await safeFetch(/g' server/shopify.ts
sed -i 's/\(\s\+\)const response = await fetch(/\1const response = await safeFetch(/g' server/shopify.ts

# Done!
echo "All fetch calls have been replaced with safeFetch."
