/**
 * Fetch Wrapper Module
 * 
 * A unified fetching interface that works across different Node.js environments
 * and deployment platforms. This handles both ES Modules and CommonJS environments.
 * 
 * This implementation provides a consistent interface regardless of:
 * 1. Whether we're in CommonJS or ES Modules
 * 2. Whether we're using native fetch (Node.js 18+) or node-fetch
 * 3. What version of node-fetch we're using (ESM-only v3+ or CJS v2)
 */

// Define the global types for our fetch interface
export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get: (name: string) => string | null;
  };
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData | URLSearchParams;
}

// This variable will hold our fetch implementation once we determine it
let fetchImpl: ((url: string, options?: any) => Promise<any>) | null = null;

/**
 * Initialize the fetch implementation - this is called only once
 * and determines the best fetch implementation available
 */
async function initFetchImplementation(): Promise<(url: string, options?: any) => Promise<any>> {
  // Try native fetch first (available in Node.js 18+)
  if (typeof globalThis.fetch === 'function') {
    console.log('Using native fetch implementation (Node.js 18+)');
    return globalThis.fetch;
  }
  
  // Next, try node-fetch with a dynamic import (works for ESM-only v3+)
  try {
    console.log('Trying dynamic import of node-fetch...');
    const nodeFetchModule = await import('node-fetch');
    // node-fetch v3+ uses ESM and has a default export
    if (nodeFetchModule.default && typeof nodeFetchModule.default === 'function') {
      console.log('Using node-fetch v3+ (ESM) implementation');
      return nodeFetchModule.default;
    }
    // node-fetch v2 compatibility (might be mounted differently)
    else if (typeof nodeFetchModule === 'function') {
      console.log('Using node-fetch v2 (CommonJS) implementation');
      return nodeFetchModule as unknown as typeof fetch;
    }
  } catch (esmError) {
    console.log('ESM import failed, trying CommonJS require...');
  }
  
  // Finally, as a fallback, try CommonJS require for node-fetch v2
  try {
    // Use a dynamic require to avoid TypeScript errors
    const commonJsRequire = eval('require');
    const nodeFetch = commonJsRequire('node-fetch');
    if (typeof nodeFetch === 'function') {
      console.log('Using node-fetch via CommonJS require');
      return nodeFetch;
    }
  } catch (cjsError) {
    console.log('CommonJS require failed');
  }
  
  // If we get here, no fetch implementation is available
  throw new Error('No fetch implementation available. Please ensure node-fetch is installed or use Node.js 18+.');
}

/**
 * The main safe fetch function that provides a consistent interface
 * regardless of the underlying implementation
 */
export async function safeFetch(url: string, options?: FetchOptions): Promise<FetchResponse> {
  try {
    // Initialize fetch implementation if it hasn't been done yet
    if (!fetchImpl) {
      fetchImpl = await initFetchImplementation();
    }
    
    // Make the fetch request
    const response = await fetchImpl(url, options);
    
    // Create a normalized response object
    const normalizedResponse: FetchResponse = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: {
        get: (name: string) => response.headers.get(name)
      },
      json: () => response.json(),
      text: () => response.text()
    };
    
    return normalizedResponse;
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    throw error;
  }
}

// Export a default function for convenience
export default safeFetch;