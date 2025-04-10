/**
 * DEPLOYMENT GUIDE
 * 
 * This file provides the complete step-by-step process for deploying the application.
 * You can view this file by running: node deployment-guide.js
 */

console.log(`
===============================================================
DEPLOYMENT GUIDE FOR SHOPIFY INTEGRATION PLATFORM
===============================================================

Follow these steps to deploy your application with all data and functionality:

STEP 1: PREPARE YOUR ENVIRONMENT
-------------------------------

1. Ensure you have a PostgreSQL database set up in your deployment environment
2. Make sure you have your Shopify API credentials ready:
   - SHOPIFY_API_KEY
   - SHOPIFY_API_SECRET 
   - SHOPIFY_STORE_URL

3. Set these environment variables in your deployment platform

STEP 2: EXPORT YOUR DATA
----------------------

Run this command in your development environment:

    node export-data.cjs

This will create a database-export.json file containing all your products, 
stats, logs, and other essential data. Download this file to your local machine.

STEP 3: CLONE OR UPLOAD YOUR CODE
-------------------------------

Upload your code to the deployment environment:
1. Clone the repository or upload your files
2. Upload the database-export.json file to the root directory

STEP 4: SET ENVIRONMENT VARIABLES
-------------------------------

Set these essential environment variables:

    DATABASE_URL=<your-postgresql-connection-string>
    SHOPIFY_API_KEY=<your-shopify-api-key>
    SHOPIFY_API_SECRET=<your-shopify-api-secret>
    SHOPIFY_STORE_URL=<your-shopify-store-url>

STEP 5: INSTALL DEPENDENCIES
--------------------------

Run this command to install all dependencies:

    npm install

STEP 6: IMPORT YOUR DATA
----------------------

Run this command to import your data:

    node import-data.cjs

This will:
- Create the necessary database tables if they don't exist
- Import all your products, stats, and logs

STEP 7: START THE APPLICATION
---------------------------

Run the complete deployment script:

    node complete-deploy.cjs

This script will:
1. Verify all environment variables
2. Connect to the database 
3. Automatically import data if needed (from database-export.json)
4. Start the server with proper Shopify API connection

TROUBLESHOOTING
--------------

SHOPIFY API CONNECTION ISSUES:

If you encounter Shopify API connection issues, there are two methods for authentication:

1. Basic Auth header method (preferred for browsers):
   - Uses Authorization: Basic <base64-encoded-credentials> header
   - Used by the complete-deploy.cjs script

2. URL credentials method (only works in Node.js, not browsers):
   - Uses https://<key>:<secret>@<store-url> format
   - May work for direct testing but not for browser access

For debugging, you can test the connection with:

    node test-deployment.cjs

DATABASE MIGRATION ISSUES:

If database tables are missing or have wrong structure:
1. Check if DATABASE_URL is correct
2. Try importing data again with node import-data.cjs
3. Check database logs for errors

VERIFICATION
-----------

After deployment:
1. Log in with: Username: Admin, Password: Ttiinnyy1
2. Verify your dashboard shows the correct product count (${1681} products)
3. Check if product cost prices are displayed correctly
4. Test syncing with Shopify

ADDITIONAL NOTES
--------------

- The app will automatically check for and import missing data
- Ensure your database has sufficient space for all your products
- Keep your Shopify API credentials secure
- Regularly back up your database

For ongoing maintenance:
1. To export fresh data: node export-data.cjs
2. To import data: node import-data.cjs
3. To deploy: node complete-deploy.cjs

===============================================================
`);