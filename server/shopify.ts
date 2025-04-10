import fetch from "node-fetch";
import { log } from './vite';
import { storage } from './storage';
import { logCostPrice } from './cost-logger';

// Simple Shopify client for interacting with the Shopify Admin API
class ShopifyClient {
  // Rate limit settings
  private readonly RATE_LIMIT_DELAY_MS = 1000; // 1 second between requests
  private readonly RATE_LIMIT_RETRY_DELAY_MS = 2000; // 2 seconds after a 429 error
  private readonly MAX_RETRIES = 3; // Maximum retries for rate-limited requests
  private lastRequestTime = 0;
  
  /**
   * Get the count of unique products (not variants) from Shopify
   * This uses the dedicated count endpoint which is efficient
   */
  async getProductCount(apiKey: string, apiSecret: string, storeUrl: string): Promise<number> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      const countUrl = `${baseUrl}/products/count.json`;
      
      log(`Fetching product count from: ${countUrl}`, 'shopify-api');
      
      const response = await this.rateLimit<{ count: number }>(countUrl, {
        headers: this.buildHeaders(apiSecret)
      });
      
      return response.count;
    } catch (error) {
      log(`Error getting product count: ${error}`, 'shopify-api');
      throw error;
    }
  }
  
  /**
   * Get the count of all variants from Shopify
   * This uses the variant count endpoint
   */
  async getVariantCount(apiKey: string, apiSecret: string, storeUrl: string): Promise<number> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      const countUrl = `${baseUrl}/variants/count.json`;
      
      log(`Fetching variant count from: ${countUrl}`, 'shopify-api');
      
      const response = await this.rateLimit<{ count: number }>(countUrl, {
        headers: this.buildHeaders(apiSecret)
      });
      
      return response.count;
    } catch (error) {
      log(`Error getting variant count, falling back to product count: ${error}`, 'shopify-api');
      // Return 0 and let the caller handle the fallback
      return 0;
    }
  }

  /**
   * Make a rate-limited API request
   * @param url The URL to request
   * @param options Fetch options
   * @returns Response from the API
   */
  private async rateLimit<T>(url: string, options: any): Promise<T> {
    // Calculate time since last request
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // If we made a request recently, delay this one to respect rate limits
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY_MS) {
      const delay = this.RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
      log(`Rate limiting: Waiting ${delay}ms before next request`, 'shopify-api');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    let retries = 0;
    
    while (true) {
      this.lastRequestTime = Date.now();
      
      try {
        const response = await fetch(url, options);
        
        // If we hit rate limits (429), back off and retry
        if (response.status === 429) {
          if (retries >= this.MAX_RETRIES) {
            log(`Rate limit exceeded and max retries (${this.MAX_RETRIES}) reached`, 'shopify-api');
            throw new Error(`Shopify API returned 429`);
          }
          
          retries++;
          log(`Rate limit hit (429). Retry ${retries}/${this.MAX_RETRIES} after ${this.RATE_LIMIT_RETRY_DELAY_MS}ms delay`, 'shopify-api');
          await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_RETRY_DELAY_MS));
          continue;
        }
        
        // For other errors, throw
        if (!response.ok) {
          throw new Error(`Shopify API returned ${response.status}`);
        }
        
        return await response.json() as T;
      } catch (error) {
        // If there was a network error (not a 429 response), throw it
        if (!(error instanceof Error) || !error.message.includes('429')) {
          throw error;
        }
        
        // Otherwise, we're handling the 429 in the loop
      }
    }
  }

  // Test Shopify connection
  async testConnection(apiKey: string, apiSecret: string, storeUrl: string): Promise<boolean> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      
      const data = await this.rateLimit<{ shop: any }>(`${baseUrl}/shop.json`, {
        headers: this.buildHeaders(apiSecret) // Use API Secret (Access Token)
      });
      
      return !!data.shop;
    } catch (error) {
      log("Shopify connection test failed: " + error, 'shopify-api');
      throw new Error("Failed to connect to Shopify");
    }
  }
  
  // Get a sample of products directly from Shopify for debugging
  async getSampleProducts(apiKey: string, apiSecret: string, storeUrl: string): Promise<any[]> {
    try {
      const products = [];
      const limit = 10; // Only fetch 10 products for the sample
      
      const baseUrl = this.buildApiUrl(storeUrl);
      const url = `${baseUrl}/products.json?limit=${limit}`;
      
      log(`Fetching sample products from Shopify: ${url}`, 'shopify-api');
      
      // Use our rate-limited fetch
      const response = await fetch(url, {
        headers: this.buildHeaders(apiSecret)
      });
      
      if (!response.ok) {
        throw new Error(`Shopify API returned ${response.status}`);
      }
      
      const data = await response.json() as { products: any[] };
      
      // Process products to get inventory items with cost prices
      for (const product of data.products) {
        for (const variant of product.variants) {
          // Get inventory item ID to fetch cost
          const inventoryItemId = variant.inventory_item_id;
          let costPrice = null;
          let rawInventoryData = null;
          
          if (inventoryItemId) {
            try {
              // Fetch the inventory item to get cost
              log(`Debug: Fetching inventory item ${inventoryItemId} for SKU ${variant.sku}`, 'shopify-api');
              const inventoryUrl = `${baseUrl}/inventory_items/${inventoryItemId}.json`;
              
              // Add delay between inventory requests
              await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
              
              const inventoryResponse = await fetch(inventoryUrl, {
                headers: this.buildHeaders(apiSecret)
              });
              
              if (inventoryResponse.ok) {
                const inventoryData = await inventoryResponse.json();
                rawInventoryData = inventoryData;
                
                // Extract cost from inventory_item
                if (inventoryData && inventoryData.inventory_item) {
                  costPrice = parseFloat(inventoryData.inventory_item.cost || '0');
                  // Use the standardized cost logger with no custom message
                  await logCostPrice(variant.sku, costPrice);
                }
              }
            } catch (error) {
              log(`Debug: Failed to fetch cost for inventory item ${inventoryItemId}: ${error}`, 'shopify-api');
            }
          }
          
          products.push({
            id: variant.id.toString(),
            title: `${product.title} - ${variant.title !== 'Default Title' ? variant.title : ''}`.trim(),
            sku: variant.sku || "",
            price: parseFloat(variant.price) || 0,
            cost: costPrice,
            costPrice: costPrice, // Add both variants to debug
            rawInventoryData, // Include raw data for debugging
            images: product.images?.map((img: any) => img.src) || [],
            vendor: product.vendor || "",
            productType: product.product_type || ""
          });
          
          // Only get first variant to keep the response size manageable
          break;
        }
      }
      
      return products;
    } catch (error) {
      log("Error fetching Shopify sample products: " + error, 'shopify-api');
      throw error;
    }
  }
  
  // Get all products from Shopify
  async getAllProducts(apiKey: string, apiSecret: string, storeUrl: string): Promise<any[]> {
    try {
      // Use a map to track unique products (excluding variants) for accurate product count
      const uniqueProductsMap = new Map(); // Map product ID to product info
      const products = [];
      let params = "?limit=250";
      let hasNextPage = true;
      
      const baseUrl = this.buildApiUrl(storeUrl);
      
      while (hasNextPage) {
        log(`Fetching products from Shopify: ${baseUrl}/products.json${params}`, 'shopify-api');
        
        // Use our rate-limited fetch for the main product request
        let response: Response;
        try {
          response = await fetch(`${baseUrl}/products.json${params}`, {
            headers: this.buildHeaders(apiSecret)
          });
          
          if (response.status === 429) {
            log(`Rate limit hit (429). Waiting ${this.RATE_LIMIT_RETRY_DELAY_MS}ms before retrying`, 'shopify-api');
            await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_RETRY_DELAY_MS));
            continue; // Retry this iteration
          }
          
          if (!response.ok) {
            throw new Error(`Shopify API returned ${response.status}`);
          }
        } catch (error) {
          throw error;
        }
        
        const data = await response.json() as { products: any[] };
        
        // Track unique products for accurate count
        for (const product of data.products) {
          // Store in our map for accurate product count
          uniqueProductsMap.set(product.id.toString(), {
            id: product.id.toString(),
            title: product.title,
            variantCount: product.variants.length
          });
        }
        
        // Process products
        for (const product of data.products) {
          // Need to fetch inventory item data to get cost price
          for (const variant of product.variants) {
            // Get inventory item ID to fetch cost
            const inventoryItemId = variant.inventory_item_id;
            let costPrice = 0;
            
            if (inventoryItemId) {
              try {
                // Fetch the inventory item to get cost - with rate limiting
                log(`Fetching inventory item ${inventoryItemId} for SKU ${variant.sku}`, 'shopify-api');
                const inventoryUrl = `${baseUrl}/inventory_items/${inventoryItemId}.json`;
                log(`Request URL: ${inventoryUrl}`, 'shopify-api');
                
                // Add delay between inventory requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
                
                let inventoryResponse: Response;
                try {
                  inventoryResponse = await fetch(inventoryUrl, {
                    headers: this.buildHeaders(apiSecret)
                  });
                  
                  if (inventoryResponse.status === 429) {
                    log(`Rate limit hit (429) for inventory. Skipping cost price for ${variant.sku}`, 'shopify-api');
                    continue; // Skip cost price for this item
                  }
                } catch (error) {
                  log(`Network error fetching inventory: ${error}`, 'shopify-api');
                  continue; // Skip cost price for this item
                }
                
                if (inventoryResponse.ok) {
                  const inventoryData = await inventoryResponse.json();
                  log(`Inventory data for ${variant.sku}: ${JSON.stringify(inventoryData).substring(0, 300)}`, 'shopify-api');
                  
                  // Correctly extract cost from inventory_item
                  if (inventoryData && inventoryData.inventory_item) {
                    costPrice = parseFloat(inventoryData.inventory_item.cost || '0');
                    await logCostPrice(variant.sku, costPrice);
                  } else {
                    log(`No inventory_item data found for SKU ${variant.sku}`, 'shopify-api');
                  }
                } else {
                  log(`Failed to fetch inventory: ${inventoryResponse.status} ${inventoryResponse.statusText}`, 'shopify-api');
                }
              } catch (error) {
                log(`Failed to fetch cost for inventory item ${inventoryItemId}: ${error}`, 'shopify-api');
              }
            }
            
            products.push({
              id: variant.id.toString(),
              productId: product.id.toString(), // Add parent product ID for reference
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
            
            // Add a delay before fetching the next page
            await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }
      }
      
      return products;
    } catch (error) {
      log("Error fetching Shopify products: " + error, 'shopify-api');
      throw error;
    }
  }
  
  // Get product by SKU
  async getProductBySku(apiKey: string, apiSecret: string, storeUrl: string, sku: string): Promise<any | null> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      
      // Use rate-limited fetch for the products request
      let response: Response;
      try {
        log(`Fetching products to find SKU ${sku}`, 'shopify-api');
        response = await fetch(`${baseUrl}/products.json?limit=250`, {
          headers: this.buildHeaders(apiSecret)
        });
        
        if (response.status === 429) {
          log(`Rate limit hit (429). Waiting before retrying`, 'shopify-api');
          await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_RETRY_DELAY_MS));
          return null; // Return null instead of retrying to prevent UI hangs
        }
        
        if (!response.ok) {
          throw new Error(`Shopify API returned ${response.status}`);
        }
      } catch (error) {
        throw error;
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
                // Fetch the inventory item to get cost - with rate limiting
                log(`Fetching inventory item ${inventoryItemId} for SKU ${variant.sku}`, 'shopify-api');
                const inventoryUrl = `${baseUrl}/inventory_items/${inventoryItemId}.json`;
                log(`Request URL: ${inventoryUrl}`, 'shopify-api');
                
                // Add delay between inventory requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
                
                const inventoryResponse = await fetch(inventoryUrl, {
                  headers: this.buildHeaders(apiSecret)
                });
                
                if (inventoryResponse.status === 429) {
                  log(`Rate limit hit (429) for inventory. Skipping cost price for ${variant.sku}`, 'shopify-api');
                } else if (inventoryResponse.ok) {
                  const inventoryData = await inventoryResponse.json();
                  log(`Inventory data for ${variant.sku}: ${JSON.stringify(inventoryData).substring(0, 300)}`, 'shopify-api');
                  
                  // Correctly extract cost from inventory_item
                  if (inventoryData && inventoryData.inventory_item) {
                    costPrice = parseFloat(inventoryData.inventory_item.cost || '0');
                    await logCostPrice(variant.sku, costPrice);
                  } else {
                    log(`No inventory_item data found for SKU ${variant.sku}`, 'shopify-api');
                  }
                } else {
                  log(`Failed to fetch inventory: ${inventoryResponse.status} ${inventoryResponse.statusText}`, 'shopify-api');
                }
              } catch (error) {
                log(`Failed to fetch cost for inventory item ${inventoryItemId}: ${error}`, 'shopify-api');
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
      log(`Error fetching Shopify product by SKU ${sku}: ${error}`, 'shopify-api');
      throw error;
    }
  }
  
  // Update product price in Shopify
  async updateProductPrice(variantId: string, price: number, compareAtPrice?: number | null): Promise<void> {
    try {
      // Use Access Token directly since that's the proper way for private apps
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      const storeUrl = process.env.SHOPIFY_STORE_URL;
      
      if (!accessToken || !storeUrl) {
        log('No Shopify credentials found in environment variables', 'shopify-api');
        throw new Error('Shopify credentials not configured');
      }
      
      // Normalize store URL
      let normalizedUrl = storeUrl;
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      console.log(`Using Shopify store URL: ${normalizedUrl}`);
      
      const baseUrl = `${normalizedUrl}/admin/api/2023-01`;
      const url = `${baseUrl}/variants/${variantId}.json`;
      
      log(`Updating Shopify variant ${variantId} price to ${price}${compareAtPrice ? ` (compareAtPrice: ${compareAtPrice})` : ''}`, 'shopify-api');
      
      // Build the update payload
      const updateData: any = {
        variant: {
          id: variantId,
          price: price.toString()
        }
      };
      
      // If compareAtPrice is provided, include it (null will clear it)
      if (compareAtPrice !== undefined) {
        updateData.variant.compare_at_price = compareAtPrice === null ? null : compareAtPrice.toString();
      }
      
      // Make the API call to update the variant
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`Failed to update Shopify variant ${variantId}: ${response.status} ${response.statusText} - ${errorText}`, 'shopify-api-error');
        throw new Error(`Shopify API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      log(`Successfully updated Shopify variant ${variantId} price to ${price}`, 'shopify-api');
      
      return;
    } catch (error) {
      log(`Error updating Shopify variant ${variantId} price: ${error}`, 'shopify-api-error');
      throw error;
    }
  }
  
  // Helper methods
  private buildApiUrl(storeUrl: string): string {
    // Handle missing or empty store URL
    if (!storeUrl || typeof storeUrl !== 'string') {
      log(`ERROR: Invalid Shopify store URL provided: ${storeUrl}`, 'shopify-api');
      throw new Error('Invalid Shopify store URL. Please check your Shopify configuration.');
    }
    
    // Make sure the storeUrl includes both protocol and myshopify.com domain
    let normalizedUrl = storeUrl.trim();
    
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
    
    log(`Normalized Shopify URL: ${normalizedUrl}`, 'shopify-api');
    return `https://${normalizedUrl}/admin/api/2022-10`;
  }
  
  // Properly handle Shopify authentication using the most reliable method based on available credentials
  private buildHeaders(accessToken: string, apiKey?: string): { [key: string]: string } {
    // Validate accessToken to avoid API errors
    if (!accessToken || typeof accessToken !== 'string') {
      log(`ERROR: Invalid Shopify API token provided: ${accessToken}`, 'shopify-api');
      throw new Error('Invalid Shopify API token. Please check your Shopify configuration.');
    }
    
    // Get API key from environment if not provided
    if (!apiKey) {
      apiKey = process.env.SHOPIFY_API_KEY;
    }
    
    // For Private Apps, the recommended authentication is X-Shopify-Access-Token
    // Using this as primary method since it's more reliable with newer Shopify API versions
    log(`Using X-Shopify-Access-Token header for Shopify API`, 'shopify-api');
    return {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
  /**
   * Get inventory cost price by ID
   */
  async getInventoryCostPrice(inventoryItemId: string): Promise<number | null> {
    try {
      // Use API Secret as the access token (that's what it is in Shopify)
      const accessToken = process.env.SHOPIFY_API_SECRET;
      const apiKey = process.env.SHOPIFY_API_KEY;
      const storeUrl = process.env.SHOPIFY_STORE_URL;
      
      if (!accessToken || !storeUrl) {
        log('No Shopify credentials found in environment variables (SHOPIFY_API_SECRET or SHOPIFY_STORE_URL)', 'shopify-api');
        return null;
      }
      
      // Normalize store URL
      let normalizedUrl = storeUrl;
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      const baseUrl = `${normalizedUrl}/admin/api/2023-01`;
      const url = `${baseUrl}/inventory_items/${inventoryItemId}.json`;
      
      log(`Fetching inventory item ${inventoryItemId}`, 'shopify-api');
      
      const response = await this.rateLimit<{ inventory_item: any }>(url, {
        headers: this.buildHeaders(accessToken, apiKey)
      });
      
      if (response && response.inventory_item && response.inventory_item.cost) {
        const costPrice = parseFloat(response.inventory_item.cost);
        log(`Got cost price for ${response.inventory_item.sku || inventoryItemId}: $${costPrice}`, 'shopify-api');
        return costPrice;
      }
      
      return null;
    } catch (error) {
      log(`Error getting inventory cost price: ${error}`, 'shopify-api');
      return null;
    }
  }
  
  /**
   * Get multiple inventory cost prices in bulk
   */
  async getBulkInventoryCostPrices(items: {inventoryItemId: string, sku: string}[]): Promise<Map<string, {costPrice: number, sku: string}>> {
    const costPrices = new Map<string, {costPrice: number, sku: string}>();

    // Use API Secret as the access token
    const accessToken = process.env.SHOPIFY_API_SECRET;
    const apiKey = process.env.SHOPIFY_API_KEY;
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    
    if (!accessToken || !storeUrl) {
      log('No Shopify credentials found in environment variables (SHOPIFY_API_SECRET or SHOPIFY_STORE_URL)', 'shopify-api');
      return costPrices;
    }
    
    // Normalize store URL
    let normalizedUrl = storeUrl;
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    if (normalizedUrl.endsWith('/')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }
    
    // Process in chunks of 50 items to avoid API limits
    const CHUNK_SIZE = 50;
    const chunks: {inventoryItemId: string, sku: string}[][] = [];
    
    // Create chunks of inventory items
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }
    
    log(`Processing ${items.length} inventory items in ${chunks.length} chunks`, 'shopify-api');
    
    // Process each chunk
    for (const chunk of chunks) {
      const baseUrl = `${normalizedUrl}/admin/api/2023-01`;
      
      // Create comma-separated list of IDs for query parameter
      const inventoryItemIds = chunk.map(item => item.inventoryItemId).join(',');
      const url = `${baseUrl}/inventory_items.json?ids=${inventoryItemIds}`;
      
      log(`Fetching bulk inventory items, chunk size: ${chunk.length}`, 'shopify-api');
      
      try {
        const response = await this.rateLimit<{ inventory_items: any[] }>(url, {
          headers: this.buildHeaders(accessToken, apiKey)
        });
        
        if (response && response.inventory_items && response.inventory_items.length > 0) {
          // Create a map of inventory item IDs to SKUs for quick lookup
          const skuMap = new Map<string, string>();
          chunk.forEach(item => skuMap.set(item.inventoryItemId, item.sku));
          
          // Process all inventory items in the response
          for (const item of response.inventory_items) {
            if (item.id && item.cost) {
              const inventoryItemId = item.id.toString();
              const costPrice = parseFloat(item.cost);
              const sku = skuMap.get(inventoryItemId) || ''; 
              
              costPrices.set(inventoryItemId, {
                costPrice,
                sku
              });
              
              // Get current sync ID to tag the logs properly
              try {
                const syncProgress = await storage.getShopifySyncProgress();
                const currentSyncId = syncProgress?.id || 0;
                
                // Log with SyncID tag for consistent formatting
                const logMessage = `Got cost price for ${sku}: $${costPrice} [SyncID: ${currentSyncId}]`;
                log(logMessage, 'shopify-api');
                
                // Log for UI display with the same format
                await logCostPrice(sku, costPrice, logMessage, undefined, undefined);
              } catch (error) {
                log(`Error logging cost price: ${error}`, 'shopify-api');
              }
            }
          }
        }
      } catch (error) {
        log(`Error getting bulk inventory cost prices: ${error}`, 'shopify-api');
        // Continue with the next chunk even if this one fails
      }
      
      // Add a small delay between chunks to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log(`Successfully retrieved ${costPrices.size} cost prices out of ${items.length} requested`, 'shopify-api');
    return costPrices;
  }

  /**
   * Get a product by its Shopify product ID
   * This retrieves the product and extracts the inventory item ID
   * 
   * @param apiKey API key (not used anymore, kept for compatibility)
   * @param apiSecret API secret (access token) (not used anymore, kept for compatibility)
   * @param storeUrl Store URL (not used anymore, kept for compatibility)
   * @param productId Shopify product ID
   * @returns Product details with inventory item ID
   */
  async getProductByID(
    apiKey: string, 
    apiSecret: string, 
    storeUrl: string,
    productId: string
  ): Promise<{ inventoryItemId: string | null }> {
    try {
      // Use API Secret as the access token and API Key from parameters
      const accessToken = process.env.SHOPIFY_API_SECRET;
      const shopifyApiKey = process.env.SHOPIFY_API_KEY;
      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
      
      if (!accessToken || !shopifyStoreUrl) {
        log('No Shopify credentials found in environment variables (SHOPIFY_API_SECRET or SHOPIFY_STORE_URL)', 'shopify-api');
        return { inventoryItemId: null };
      }
      
      // Normalize store URL
      let normalizedUrl = shopifyStoreUrl;
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      const baseUrl = `${normalizedUrl}/admin/api/2023-01`;
      const url = `${baseUrl}/products/${productId}.json`;
      
      log(`Fetching product by ID: ${url}`, 'shopify-api');
      
      const response = await this.rateLimit<{ product: any }>(url, {
        headers: this.buildHeaders(accessToken, shopifyApiKey)
      });
      
      // Extract the inventory item ID from the first variant
      if (response.product?.variants?.length > 0) {
        const variant = response.product.variants[0];
        return { 
          inventoryItemId: variant.inventory_item_id?.toString() || null
        };
      }
      
      return { inventoryItemId: null };
    } catch (error) {
      log(`Error getting product by ID: ${error}`, 'shopify-api');
      return { inventoryItemId: null };
    }
  }
  
  /**
   * Get inventory items by their IDs in bulk
   * This uses the bulk endpoint to efficiently fetch multiple inventory items
   * 
   * @param apiKey API key (not used anymore, kept for compatibility)
   * @param apiSecret API secret (access token) (not used anymore, kept for compatibility)
   * @param storeUrl Store URL (not used anymore, kept for compatibility)
   * @param inventoryItemIds Comma-separated list of inventory item IDs
   * @returns Inventory items data
   */
  async getInventoryItemsByIds(
    apiKey: string,
    apiSecret: string,
    storeUrl: string,
    inventoryItemIds: string
  ): Promise<{ inventory_items: any[] }> {
    try {
      // Use API Secret as the access token
      const accessToken = process.env.SHOPIFY_API_SECRET;
      const shopifyApiKey = process.env.SHOPIFY_API_KEY;
      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
      
      if (!accessToken || !shopifyStoreUrl) {
        log('No Shopify credentials found in environment variables (SHOPIFY_API_SECRET or SHOPIFY_STORE_URL)', 'shopify-api');
        return { inventory_items: [] };
      }
      
      // Normalize store URL
      let normalizedUrl = shopifyStoreUrl;
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.slice(0, -1);
      }
      
      const baseUrl = `${normalizedUrl}/admin/api/2023-01`;
      const url = `${baseUrl}/inventory_items.json?ids=${inventoryItemIds}`;
      
      log(`Fetching inventory items by IDs: ${url}`, 'shopify-api');
      
      const response = await this.rateLimit<{ inventory_items: any[] }>(url, {
        headers: this.buildHeaders(accessToken, shopifyApiKey)
      });
      
      return response;
    } catch (error) {
      log(`Error getting inventory items by IDs: ${error}`, 'shopify-api');
      return { inventory_items: [] };
    }
  }
}

export const shopifyClient = new ShopifyClient();
