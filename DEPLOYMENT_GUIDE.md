# Deployment Guide for Replit

## Problem: Missing Data in Deployed App

If your data shows up in the local Replit editor but not in the deployed app (https://modzmartsuite.replit.app/), 
this is because the deployed app is using a different database than your local environment.

## Solution: Run the Database Fix Script

1. Make sure all environment variables are correctly set in Replit Secrets:
   - `DATABASE_URL` (this is critical!)
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `SHOPIFY_STORE_URL`

2. Run the special database fix script:
   ```
   node fix-database-on-replit.cjs
   ```

3. This script will:
   - Connect to the database using the DATABASE_URL from Replit Secrets
   - Create tables if they don't exist
   - Import all 1,681 products from database-export.json
   - Import the stats, shopify_logs, and notifications
   - Verify that the data was imported successfully

4. After running this script, restart your application and the data should appear
   in the deployed app.

## Step-by-Step Instructions

1. Open Replit and access your project
2. Click on the "Secrets" icon (lock symbol) in the left sidebar
3. Make sure DATABASE_URL is set correctly:
   - If it's not set, add a new secret named DATABASE_URL
   - The value should be the full PostgreSQL connection string
4. Open a terminal (Shell) in Replit
5. Run the fix script:
   ```
   node fix-database-on-replit.cjs
   ```
6. Wait for the script to complete (it will show a success message)
7. Restart your app using the "Run" button
8. Go to https://modzmartsuite.replit.app/ and log in

## Authentication

Your app uses these hardcoded credentials:
- Username: Admin
- Password: Ttiinnyy1

## Troubleshooting

If you're still having trouble after running the fix script:

1. Check the console output of the fix script for any errors
2. Make sure you're using the correct login credentials
3. Ensure the database-export.json file exists and contains all your product data
4. Try running the simple-deploy.cjs script instead:
   ```
   node simple-deploy.cjs
   ```

## Explanation of the Issue

The issue occurs because Replit has two databases:
1. A local database used while developing in the editor
2. A separate database used by the deployed app

The fix script ensures your product data is imported into the deployment database.