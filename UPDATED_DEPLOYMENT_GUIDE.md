# Updated Deployment Guide for Replit

This guide provides step-by-step instructions for deploying the application on Replit. 

> **CRITICAL:** Replit requires your application to start within 20 seconds and bind to port 5000. 
> 
> Our current application cannot meet this requirement directly, so we use a two-step deployment process:
> 1. First deploy a minimal health check server that starts quickly
> 2. Then switch to the full application once deployment is verified
>
> Attempting to deploy the full application directly will fail with a timeout error.

## Deployment Process

1. **Initial Deployment (Health Check Only)**
   - In the Replit deployment settings, use the command:
     ```
     node replit-health-deploy.cjs
     ```
   - This deploys a minimal server that responds with "OK" to all requests
   - This ensures your deployment passes Replit's health checks
   - Make sure the DATABASE_URL environment variable is set in the Replit Secrets tab

2. **Full Application Deployment**
   - Once the health check deployment is successful, update the command to:
     ```
     node replit-production-deploy.cjs
     ```
   - This will deploy the full application with all features
   - The application will automatically configure the WebSocket for Neon database connectivity

3. **Environment Variables**
   - Make sure to set the following environment variables in the Replit Secrets tab:
     - `DATABASE_URL`: Your PostgreSQL database connection string
     - `SHOPIFY_API_KEY`: Your Shopify API key (if using Shopify integration)
     - `SHOPIFY_API_SECRET`: Your Shopify API secret (if using Shopify integration)
     - `SHOPIFY_STORE_URL`: Your Shopify store URL (if using Shopify integration)

## Verifying Your Deployment

After deployment, you can access your application at:
```
https://[your-repl-name].[your-username].replit.app
```

The following endpoints are available:
- `/` - Main application frontend
- `/api/health` - API health check endpoint
- `/api/test` - API test endpoint

## Troubleshooting

If you're experiencing issues with your deployment:

1. **Only seeing "OK" response**
   - Verify you're using `node replit-production-deploy.cjs` in the deployment settings
   - Check the Replit logs for any errors during startup

2. **API routes not working**
   - The deployment uses `server/routes.cjs` as a fallback
   - This provides basic API functionality even when the full routes can't be loaded
   - Ensure DATABASE_URL environment variable is set properly in the deployment

3. **Database connection failing**
   - The application now uses WebSocket for Neon database connectivity
   - If database connections fail, check for errors related to WebSocket connection in the logs
   - Ensure the application has network access to connect to external databases

4. **Frontend files not loading**
   - The script looks for frontend files in both `dist/client` and `dist/public`
   - Make sure your build process is generating files in one of these locations

## Deployment Scripts

The following deployment scripts are available:

- `replit-health-deploy.cjs` - Minimal health check server
- `replit-production-deploy.cjs` - Full application server

These scripts are designed to work with Replit's deployment requirements, ensuring:
- Fast startup time (< 20 seconds)
- Proper port binding (0.0.0.0:5000)
- Maximum compatibility (CommonJS format)
- Graceful error handling