/**
 * Cross-environment Fetch Wrapper (CommonJS Version)
 * 
 * This module provides a consistent fetch API interface across different environments
 * with multiple fallback strategies:
 * 
 * 1. Native fetch if available
 * 2. node-fetch dynamically imported (for ESM compatibility)
 * 3. Legacy alternatives
 * 
 * This CommonJS version is specifically designed to work reliably
 * in Replit deployments where ES Module handling can be inconsistent.
 */

let fetchImplementation = null;

// Define the response interface for consistency
class FetchResponse {
  constructor(response) {
    this.ok = response.ok;
    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this._response = response;
  }

  async json() {
    return await this._response.json();
  }

  async text() {
    return await this._response.text();
  }
}

/**
 * Initialize the fetch implementation - this is called only once
 * and determines the best fetch implementation available
 */
async function initFetchImplementation() {
  if (fetchImplementation) {
    return fetchImplementation;
  }

  // Try native fetch first (Node.js 18+)
  if (typeof fetch === 'function') {
    console.log('Using native fetch implementation');
    fetchImplementation = fetch;
    return fetchImplementation;
  }

  // Try node-fetch as fallback
  try {
    console.log('Native fetch not available, trying to import node-fetch');
    
    // Use dynamic require for node-fetch
    const fetchModule = require('node-fetch');
    fetchImplementation = fetchModule.default || fetchModule;
    
    console.log('Successfully imported node-fetch');
    return fetchImplementation;
  } catch (error) {
    console.error('Error importing node-fetch:', error);
  }

  // Final fallback: use https module directly
  console.warn('Falling back to https module for fetch operations');
  const https = require('https');
  const http = require('http');

  fetchImplementation = function simpleFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const requestModule = isHttps ? https : http;
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: options.headers || {},
      };

      const req = requestModule.request(url, requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const response = {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: {
              get: (name) => res.headers[name.toLowerCase()] || null,
            },
            json: () => Promise.resolve(JSON.parse(data)),
            text: () => Promise.resolve(data),
          };
          
          resolve(new FetchResponse(response));
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      
      req.end();
    });
  };

  return fetchImplementation;
}

/**
 * The main safe fetch function that provides a consistent interface
 * regardless of the underlying implementation
 */
async function safeFetch(url, options) {
  const fetchFunction = await initFetchImplementation();
  
  try {
    const response = await fetchFunction(url, options);
    return new FetchResponse(response);
  } catch (error) {
    console.error(`Fetch error for URL ${url}:`, error);
    
    return {
      ok: false,
      status: 'error',
      statusText: error.message,
      headers: {
        get: () => null,
      },
      json: () => Promise.resolve({ error: error.message }),
      text: () => Promise.resolve(error.message),
    };
  }
}

module.exports = safeFetch;
module.exports.FetchResponse = FetchResponse;