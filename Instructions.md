
# Shopify API Authentication Fix Instructions

## Current Implementation Analysis
- Main Shopify API integration is in `server/shopify.ts`
- Environment variables accessed in multiple ways:
  - Direct process.env access in shopifyClient class
  - Mixed usage between passed parameters and env vars
- Authentication uses X-Shopify-Access-Token header
- Credentials stored in both env vars and database

## Issues Identified
1. Inconsistent credential access between different methods
2. Access token stored as SHOPIFY_API_SECRET but referenced as SHOPIFY_ACCESS_TOKEN
3. Missing environment variable validation
4. No central credential management

## Fix Implementation

### 1. Add Environment Variables
Ensure these secrets are set in the Replit Secrets tab:
- SHOPIFY_ACCESS_TOKEN (your Shopify admin API access token)
- SHOPIFY_API_KEY
- SHOPIFY_STORE_URL (format: your-store.myshopify.com)

### 2. Update Authentication Headers
The updated code should consistently use SHOPIFY_ACCESS_TOKEN for authentication. This matches Shopify's recommended private app authentication method.

### 3. Centralize Credential Management
A new credentials helper in storage.ts ensures consistent access to Shopify credentials.

### 4. Error Handling
Added proper error handling and validation for missing credentials.

## Testing Instructions
1. Set required secrets in Replit Secrets tab
2. Test connection using Settings page
3. Monitor deployment logs for auth errors
4. Verify successful API calls in Shopify admin audit log

## Common Issues
- 401 Unauthorized: Check SHOPIFY_ACCESS_TOKEN value
- Invalid API key: Verify SHOPIFY_API_KEY format
- URL errors: Ensure SHOPIFY_STORE_URL is correctly formatted
