/**
 * Module Compatibility Helper
 * 
 * This module provides compatibility helpers for mixing ES Modules and CommonJS code.
 * Import this in any file that needs to use both module systems.
 */

import { createRequire } from 'module';

// Create a require function that works within ES modules
export const compatRequire = createRequire(import.meta.url);

// Helper function to dynamically import a module in either format
export async function dynamicImport(modulePath) {
  try {
    // Try ES module import first
    return await import(modulePath);
  } catch (esError) {
    try {
      // Fall back to CommonJS require if ES import fails
      return compatRequire(modulePath);
    } catch (cjsError) {
      throw new Error(
        `Failed to import module '${modulePath}': ` +
        `ES Module error: ${esError.message}, ` +
        `CommonJS error: ${cjsError.message}`
      );
    }
  }
}

// Check if we're in production mode
export const isProduction = process.env.NODE_ENV === 'production';

// A safe require that falls back to null if module not found
export function safeRequire(modulePath) {
  try {
    return compatRequire(modulePath);
  } catch (error) {
    console.warn(`Warning: Failed to require '${modulePath}': ${error.message}`);
    return null;
  }
}