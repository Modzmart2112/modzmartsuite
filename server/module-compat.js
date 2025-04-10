/**
 * Module Compatibility Helper
 * 
 * This file provides compatibility functions for working with both
 * ES Modules and CommonJS code in the same project.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Create a require function that can be used in ES modules
export const moduleRequire = createRequire(import.meta.url);

// Create __filename and __dirname for ES modules
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

// Export to global scope for legacy code
if (typeof global !== 'undefined') {
  // Only set require in global scope if it doesn't exist
  if (!global.require) {
    global.require = moduleRequire;
  }
  
  // Set __filename and __dirname if they don't exist
  if (!global.__filename) {
    global.__filename = __filename;
  }
  
  if (!global.__dirname) {
    global.__dirname = __dirname;
  }
}

// Helper to handle both types of exports
export function normalizeExports(module) {
  if (module && module.default) {
    return module.default;
  }
  return module;
}