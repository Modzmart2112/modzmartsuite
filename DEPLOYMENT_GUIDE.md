# Shopify Integration Platform - Deployment Guide

This guide explains how to deploy the Shopify Integration Platform using Replit's deployment functionality.

## Pre-Deployment Checklist

Before deploying, make sure you have:

1. All required environment variables set in your Replit Secrets:
   - `SHOPIFY_ACCESS_TOKEN` - Your Shopify Admin API access token
   - `SHOPIFY_API_KEY` - Your Shopify API key 
   - `SHOPIFY_STORE_URL` - Your Shopify store URL
   - `DATABASE_URL` - PostgreSQL database connection string

2. Built the application:
   ```
   npm run build
   ```

3. Made sure all files are committed to your repository

## Deployment Steps

1. **Configure the deployment settings in the Replit interface:**
   - Go to your project's `Deployment` tab
   - For the `Run command`, use:
     ```
     node reliable-deploy.js
     ```
   - For the `Build command`, use:
     ```
     npm run build
     ```

2. **Deploy your application**
   - Click the "Deploy" button in the Replit interface
   - Wait for the build and deployment process to complete

3. **Verify your deployment**
   - Once deployed, visit your application's URL
   - Check that you can log in and access the dashboard
   - Verify that Shopify integration features are working correctly

## Troubleshooting Common Deployment Issues

### Application Failing to Start

If the application fails to start in production:

1. **Check environment variables**
   - Ensure all required environment variables are set

2. **Database connection issues**
   - Verify that your PostgreSQL database is accessible from the deployment
   - Check the connection string for errors

3. **Server binding issues**
   - Our production script binds to `0.0.0.0` to ensure external accessibility
   - If you modified the script, make sure it still binds to `0.0.0.0`

4. **Using the wrong entry point**
   - Make sure you're using `node reliable-deploy.js` as the run command
   
5. **Module system compatibility issues**
   - If you see "ReferenceError: require is not defined" errors in your logs
   - Import `server/module-compat.js` and use `compatRequire` instead of `require`
   - Example: `import { compatRequire } from './module-compat.js'`

### Shopify API Issues

If the Shopify integration isn't working:

1. **Check API credentials**
   - Verify that your Shopify API credentials are correct
   - Ensure your access token has the necessary scopes

2. **API rate limiting**
   - Check logs for API rate limiting errors
   - Consider implementing additional rate limiting on your side

## Production Mode Tools

The application includes several tools to help with production deployment:

- `reliable-deploy.js` - Recommended main entry point for Replit deployment (supports both ES modules and CommonJS)
- `replit-production.js` - Alternative production server script
- `production.js` - Another production server script option
- `deploy-dist.js` - Simple static file server (fallback if main app fails)

## Maintenance

After deployment:

1. Regularly check logs for errors or performance issues
2. Monitor database size and performance 
3. Keep your Shopify API credentials secure and rotate them periodically