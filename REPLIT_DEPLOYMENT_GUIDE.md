# REPLIT DEPLOYMENT GUIDE

This document provides detailed instructions on how to deploy this application on Replit.

## Prerequisites

Before deploying, make sure you have:

1. All necessary environment secrets:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET` or `SHOPIFY_ACCESS_TOKEN`
   - `SHOPIFY_STORE_URL`
   - `DATABASE_URL`

2. A built version of the application: Run `npm run build` before deploying.

## Deployment Steps

### Method 1: Using the Replit UI (Recommended)

1. Click on the **Deployment** tab in the Replit sidebar (rocket icon).
2. Click on **Deploy** button.
3. Wait for the deployment process to complete.
4. Your app will be available at your Replit subdomain (e.g., `https://yourapp.replit.app`).

### Method 2: Manual Deployment

If the automatic deployment through the UI doesn't work, follow these steps:

1. Run the build command:
   ```
   npm run build
   ```

2. Run the deployment script:
   ```
   node replit-deploy.cjs
   ```

3. This will start the server in production mode.

## Troubleshooting

If you encounter issues with deployment:

### Health Check Failures

- The health check expects a response from the root URL (`/`) with status 200.
- The `replit-deploy.cjs` script sets up an appropriate health check endpoint.
- Make sure the root route returns a 200 status and a JSON response with `{"status":"healthy"}`.

### Server Starting but Exiting Immediately

- Check the deployment logs for specific error messages.
- Ensure that the server is properly binding to the port specified in the `PORT` environment variable.
- Ensure the server is listening on `0.0.0.0` and not just `localhost`.

### API Key Issues

- If you see Shopify API errors, check that your environment secrets are properly set.
- The application expects `SHOPIFY_API_SECRET` to contain the access token.

## Deployment Files

This project contains several deployment-related files:

- `replit-deploy.cjs`: Main deployment script for Replit, includes health check endpoint and static file serving.
- `deploy.cjs`: Simple wrapper that calls the main deployment script.

## Important Notes

- The deployment script automatically copies `SHOPIFY_ACCESS_TOKEN` to `SHOPIFY_API_SECRET` if needed.
- The server binds to `0.0.0.0` to make it accessible to external requests.
- Health checks are handled at the root URL (`/`).
- Browser requests to the root URL will be redirected to `/dashboard`.