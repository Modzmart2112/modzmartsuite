# Module Compatibility Guide

This guide explains how to handle ES Modules and CommonJS compatibility issues that may arise when deploying the application.

## Understanding the Issue

This application uses ES Modules (`import`/`export`) but some parts of the codebase or dependencies might still use CommonJS (`require`/`module.exports`). In a production setting, this can lead to errors like:

```
ReferenceError: require is not defined
```

This happens because ES Modules don't have access to the `require` function.

## Solutions

### 1. Use the Compatibility Helper

We've created a compatibility helper that provides a `require` function that works in ES Modules. Use this approach for the simplest fix:

```javascript
// Import the compatibility helper
import { compatRequire } from './server/module-compat.js';

// Use compatRequire instead of require
const somePackage = compatRequire('some-package');
```

### 2. Use Dynamic Imports

For more advanced use cases, you can use dynamic imports:

```javascript
// Use the dynamicImport helper for maximum compatibility
import { dynamicImport } from './server/module-compat.js';

async function loadModule() {
  const module = await dynamicImport('./path/to/module.js');
  // Use module here
}
```

### 3. Safe Requiring

If a module might not be available, use the safe require helper:

```javascript
import { safeRequire } from './server/module-compat.js';

// This won't throw an error if the module is missing
const optionalModule = safeRequire('optional-module');
if (optionalModule) {
  // Use the module
} else {
  // Handle the case where the module is not available
}
```

## Common Areas Needing Fixes

The following areas in the codebase might need compatibility fixes:

1. Direct SQL operations (using `require('pg')` or similar)
2. File system operations (using `require('fs')`)
3. Third-party integrations

## Testing

When you encounter a "require is not defined" error:

1. Identify which file is using `require`
2. Import the compatibility module at the top of that file
3. Replace `require()` calls with `compatRequire()`
4. Test in production mode again

## Notes for Future Development

- When adding new files, consistently use ES Modules syntax
- If using CommonJS-style modules, consider converting them to ES Modules
- Always test in production mode before deploying