import fetch from "node-fetch";

// Simple Shopify client for interacting with the Shopify Admin API
class ShopifyClient {
  // Test Shopify connection
  async testConnection(apiKey: string, apiSecret: string, storeUrl: string): Promise<boolean> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      const response = await fetch(`${baseUrl}/shop.json`, {
        headers: this.buildHeaders(apiSecret) // Use API Secret (Access Token)
      });
      
      if (!response.ok) {
        console.error(`Shopify API returned status ${response.status}`);
        throw new Error(`Shopify API returned ${response.status}`);
      }
      
      const data = await response.json() as { shop: any };
      return !!data.shop;
    } catch (error) {
      console.error("Shopify connection test failed:", error);
      throw new Error("Failed to connect to Shopify");
    }
  }
  
  // Get all products from Shopify
  async getAllProducts(apiKey: string, apiSecret: string, storeUrl: string): Promise<any[]> {
    try {
      const products = [];
      let params = "?limit=250";
      let hasNextPage = true;
      
      const baseUrl = this.buildApiUrl(storeUrl);
      
      while (hasNextPage) {
        console.log(`Fetching products from Shopify: ${baseUrl}/products.json${params}`);
        const response = await fetch(`${baseUrl}/products.json${params}`, {
          headers: this.buildHeaders(apiSecret)
        });
        
        if (!response.ok) {
          throw new Error(`Shopify API returned ${response.status}`);
        }
        
        const data = await response.json() as { products: any[] };
        
        // Process products
        for (const product of data.products) {
          // Need to fetch inventory item data to get cost price
          for (const variant of product.variants) {
            // Get inventory item ID to fetch cost
            const inventoryItemId = variant.inventory_item_id;
            let costPrice = 0;
            
            if (inventoryItemId) {
              try {
                // Fetch the inventory item to get cost
                console.log(`Fetching inventory item ${inventoryItemId} for SKU ${variant.sku}`);
                const inventoryUrl = `${baseUrl}/inventory_items/${inventoryItemId}.json`;
                console.log(`Request URL: ${inventoryUrl}`);
                
                const inventoryResponse = await fetch(inventoryUrl, {
                  headers: this.buildHeaders(apiSecret)
                });
                
                if (inventoryResponse.ok) {
                  const inventoryData = await inventoryResponse.json();
                  console.log(`Inventory data for ${variant.sku}:`, JSON.stringify(inventoryData).substring(0, 300));
                  
                  // Correctly extract cost from inventory_item
                  if (inventoryData && inventoryData.inventory_item) {
                    costPrice = parseFloat(inventoryData.inventory_item.cost || '0');
                    console.log(`Got cost price for ${variant.sku}: $${costPrice}`);
                  } else {
                    console.warn(`No inventory_item data found for SKU ${variant.sku}`);
                  }
                } else {
                  console.error(`Failed to fetch inventory: ${inventoryResponse.status} ${inventoryResponse.statusText}`);
                }
              } catch (error) {
                console.error(`Failed to fetch cost for inventory item ${inventoryItemId}:`, error);
              }
            }
            
            products.push({
              id: variant.id.toString(),
              title: `${product.title} - ${variant.title !== 'Default Title' ? variant.title : ''}`.trim(),
              description: product.body_html || "",
              sku: variant.sku || "",
              price: parseFloat(variant.price) || 0,
              cost: costPrice, // Add cost price from Shopify's inventory item
              images: product.images?.map((img: any) => img.src) || [],
              vendor: product.vendor || "",
              productType: product.product_type || ""
            });
          }
        }
        
        // Check for pagination
        const linkHeader = response.headers.get('Link');
        
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (match && match[1]) {
            const url = new URL(match[1]);
            params = url.search;
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
      }
      
      return products;
    } catch (error) {
      console.error("Error fetching Shopify products:", error);
      throw error;
    }
  }
  
  // Get product by SKU
  async getProductBySku(apiKey: string, apiSecret: string, storeUrl: string, sku: string): Promise<any | null> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      const response = await fetch(`${baseUrl}/products.json?limit=250`, {
        headers: this.buildHeaders(apiSecret)
      });
      
      if (!response.ok) {
        throw new Error(`Shopify API returned ${response.status}`);
      }
      
      const data = await response.json() as { products: any[] };
      
      for (const product of data.products) {
        for (const variant of product.variants) {
          if (variant.sku === sku) {
            // Get inventory item data to fetch cost price
            let costPrice = 0;
            const inventoryItemId = variant.inventory_item_id;
            
            if (inventoryItemId) {
              try {
                // Fetch the inventory item to get cost
                console.log(`Fetching inventory item ${inventoryItemId} for SKU ${variant.sku}`);
                const inventoryUrl = `${baseUrl}/inventory_items/${inventoryItemId}.json`;
                console.log(`Request URL: ${inventoryUrl}`);
                
                const inventoryResponse = await fetch(inventoryUrl, {
                  headers: this.buildHeaders(apiSecret)
                });
                
                if (inventoryResponse.ok) {
                  const inventoryData = await inventoryResponse.json();
                  console.log(`Inventory data for ${variant.sku}:`, JSON.stringify(inventoryData).substring(0, 300));
                  
                  // Correctly extract cost from inventory_item
                  if (inventoryData && inventoryData.inventory_item) {
                    costPrice = parseFloat(inventoryData.inventory_item.cost || '0');
                    console.log(`Got cost price for ${variant.sku}: $${costPrice}`);
                  } else {
                    console.warn(`No inventory_item data found for SKU ${variant.sku}`);
                  }
                } else {
                  console.error(`Failed to fetch inventory: ${inventoryResponse.status} ${inventoryResponse.statusText}`);
                }
              } catch (error) {
                console.error(`Failed to fetch cost for inventory item ${inventoryItemId}:`, error);
              }
            }
            
            return {
              id: variant.id.toString(),
              title: `${product.title} - ${variant.title !== 'Default Title' ? variant.title : ''}`.trim(),
              description: product.body_html || "",
              sku: variant.sku,
              price: parseFloat(variant.price) || 0,
              cost: costPrice, // Use the fetched cost price
              images: product.images?.map((img: any) => img.src) || [],
              vendor: product.vendor || "",
              productType: product.product_type || ""
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching Shopify product by SKU ${sku}:`, error);
      throw error;
    }
  }
  
  // Update product price in Shopify
  async updateProductPrice(variantId: string, price: number): Promise<void> {
    // This is a simplified implementation
    // In a real app, this would call the Shopify API to update the product price
    console.log(`Updating Shopify variant ${variantId} price to ${price}`);
  }
  
  // Helper methods
  private buildApiUrl(storeUrl: string): string {
    // Make sure the storeUrl includes both protocol and myshopify.com domain
    let normalizedUrl = storeUrl;
    
    // Add protocol if missing
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // Add myshopify.com if missing
    if (!normalizedUrl.includes('myshopify.com')) {
      normalizedUrl = normalizedUrl.replace(/\/$/, '');
      if (!normalizedUrl.includes('.')) {
        normalizedUrl += '.myshopify.com';
      }
    }
    
    // Strip protocol for final URL construction
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    console.log(`Normalized Shopify URL: ${normalizedUrl}`);
    return `https://${normalizedUrl}/admin/api/2022-10`;
  }
  
  // Shopify expects the Access Token as a bearer token
  private buildHeaders(accessToken: string): { [key: string]: string } {
    return {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    };
  }
}

export const shopifyClient = new ShopifyClient();
