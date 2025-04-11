#!/bin/bash

# Update all Response types to ResponseType
sed -i 's/let response: Response;/let response: ResponseType;/g' server/shopify.ts
sed -i 's/let inventoryResponse: Response;/let inventoryResponse: ResponseType;/g' server/shopify.ts

# Done!
echo "All Response types have been updated to ResponseType."
