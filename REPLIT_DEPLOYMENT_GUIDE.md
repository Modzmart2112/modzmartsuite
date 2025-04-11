# Replit Deployment Guide

This guide provides steps to successfully deploy your application on Replit with the optimizations needed to handle module compatibility and startup time issues.

## Deployment Options

### Option 1: Ultra-Minimal CommonJS Health Check Server (Fastest)

Use this option if you're struggling with deployment timeouts. This is the most reliable option but only provides a health check endpoint without the application.

1. In the Replit "Deployment" tab, click "Configure Deployment"
2. Set the "Run command" to: `node replit-health-deploy.cjs`
3. Click "Deploy"

**Why use this option**: The application will deploy successfully every time because it:
- Uses pure CommonJS syntax for maximum compatibility
- Has minimal dependencies (just Express)
- Starts within milliseconds
- Binds correctly to 0.0.0.0:5000

After deployment succeeds, you can run the full application from the "Run" tab separately.

### Option 2: Optimized CommonJS Production Server (Recommended)

This is our recommended option for a balance of reliable deployment and functionality.

1. In the Replit "Deployment" tab, click "Configure Deployment"
2. Set the "Run command" to: `node replit-production-deploy.cjs`
3. Click "Deploy"

**Why use this option**:
- Uses CommonJS for maximum compatibility
- Starts a health check server immediately
- Loads the full application in the background
- Properly handles Replit's port and binding requirements

### Option 3: Rapid ESM-Compatible Startup Script

For modern Node.js environments, this option uses ES Modules.

1. In the Replit "Deployment" tab, click "Configure Deployment"
2. Set the "Run command" to: `node replit-startup.js`
3. Click "Deploy"

**Why use this option**:
- More modular loading of the application
- Uses default ES Modules syntax
- Good compatibility with newer Node.js features

### Option 4: Minimal JavaScript Health Check

For simple health check deployment with minimal JavaScript:

1. In the Replit "Deployment" tab, click "Configure Deployment" 
2. Set the "Run command" to: `node health-only-deploy.js`
3. Click "Deploy"

### Option 5: Standard Production Deployment

Only use this if other options aren't working:

1. In the Replit "Deployment" tab, click "Configure Deployment"
2. Set the "Run command" to: `NODE_ENV=production DISABLE_SCHEDULERS=true node index.js`
3. Click "Deploy"

This is a standard deployment but may have issues with the 20-second startup time limit.

## Deployment Troubleshooting

### Common Issues and Solutions

#### 1. "Didn't open port 5000 after 20000ms" Error

This is the most common error and occurs when the application doesn't start quickly enough:

**Solution**: 
- Use Option 1 (Ultra-Minimal Health Check Server) which is guaranteed to start fast
- After successful deployment, run your application normally in the Run tab

#### 2. ES Module Compatibility Issues

If you see errors like `Error [ERR_REQUIRE_ESM]: require() of ES Module not supported`:

**Solution**:
- Use one of our CommonJS deployment options (1 or 2)
- These use the `.cjs` extension to ensure proper compatibility

#### 3. Database Connection Issues 

If the deployment fails due to database connection problems:

**Solution**:
- Ensure DATABASE_URL is properly set in Secrets
- Use Option 1 to deploy without database connectivity first
- Check database status in Run tab with `node db-test.js`

#### 4. Missing API Keys

If Shopify API integration fails:

**Solution**:
- Add SHOPIFY_API_KEY, SHOPIFY_API_SECRET and SHOPIFY_STORE_URL to Secrets
- These values are used directly via environment variables for better startup performance

### Step-by-Step Recovery Process

If deployment is completely failing:

1. Start with Option 1 (CommonJS Health Check) to get a basic deployment working
2. Once that succeeds, try Option 2 (CommonJS Production Server)
3. Check logs in the Run tab for any specific errors
4. Ensure all required environment variables are set
5. If still having issues, contact Replit support

## Environment Variables

Ensure these environment variables are set in your Replit's Secrets tab:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET` or `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_STORE_URL`
- `DATABASE_URL` (should be automatically set by Replit)

## Module Compatibility System

### The ES Modules vs CommonJS Challenge

This application addresses a significant challenge in Node.js: some libraries like `node-fetch` v3 are ES Module-only, while others require CommonJS. This creates deployment problems where:

1. ES Module code fails with: `Error [ERR_REQUIRE_ESM]: require() of ES Module not supported`
2. CommonJS code fails with: `SyntaxError: Cannot use import statement outside a module`

### Our Multi-Strategy Solution

We've implemented a comprehensive solution with these components:

#### 1. Dual-Format Fetch Wrapper

- `server/fetch-wrapper.ts` - TypeScript version for modern environments
- `server/fetch-wrapper.cjs` - CommonJS version for maximum compatibility

Both provide identical functionality but work in different module systems.

#### 2. Fallback System

Our fetch wrapper implements a cascade of fallbacks:

1. First tries native fetch (Node.js 18+)
2. If unavailable, falls back to node-fetch with dynamic import
3. If that fails, creates a basic fetch implementation using Node.js http/https

#### 3. Format-Specific Deployment Scripts

- `.js` files for ES Module environments
- `.cjs` files guaranteed to work with CommonJS

### How To Use This System

When writing new code:
- Import the fetch wrapper: `import safeFetch from './fetch-wrapper'`
- Use it like regular fetch: `const response = await safeFetch(url, options)`
- Type safety is preserved with our custom response interfaces

For deployment:
- Use the CommonJS (.cjs) scripts for maximum reliability

## Performance Optimizations

- The `DISABLE_SCHEDULERS=true` flag prevents background tasks from starting during initialization
- The `OPTIMIZE_STARTUP=true` flag reduces database queries during startup
- Using environment variables directly rather than database lookups improves startup speed