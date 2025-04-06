import fetch from "node-fetch";

// Simple Shopify client for interacting with the Shopify Admin API
class ShopifyClient {
  // Test Shopify connection
  async testConnection(apiKey: string, apiSecret: string, storeUrl: string): Promise<boolean> {
    try {
      const baseUrl = this.buildApiUrl(storeUrl);
      const response = await fetch(`${baseUrl}/shop.json`, {
        headers: this.buildHeaders(apiKey, apiSecret)
      });
      
      if (!response.ok) {
        throw new Error(`Shopify API returned ${response.status}`);
      }
      
      const data = await response.json();
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
        const response = await fetch(`${baseUrl}/products.json${params}`, {
          headers: this.buildHeaders(apiKey, apiSecret)
        });
        
        if (!response.ok) {
          throw new Error(`Shopify API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // Process products
        for (const product of data.products) {
          // For each variant, create a separate product entry
          for (const variant of product.variants) {
            products.push({
              id: variant.id.toString(),
              title: `${product.title} - ${variant.title !== 'Default Title' ? variant.title : ''}`.trim(),
              description: product.body_html || "",
              sku: variant.sku || "",
              price: parseFloat(variant.price) || 0,
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
        headers: this.buildHeaders(apiKey, apiSecret)
      });
      
      if (!response.ok) {
        throw new Error(`Shopify API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      for (const product of data.products) {
        for (const variant of product.variants) {
          if (variant.sku === sku) {
            return {
              id: variant.id.toString(),
              title: `${product.title} - ${variant.title !== 'Default Title' ? variant.title : ''}`.trim(),
              description: product.body_html || "",
              sku: variant.sku,
              price: parseFloat(variant.price) || 0,
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
    const normalizedUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${normalizedUrl}/admin/api/2022-10`;
  }
  
  private buildHeaders(apiKey: string, apiSecret: string): { [key: string]: string } {
    const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json'
    };
  }
}

export const shopifyClient = new ShopifyClient();
