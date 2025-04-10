# Data Migration Guide for Replit Deployment

This guide explains how to transfer your database data between your development environment and your Replit deployment.

## Understanding the Problem

When you deploy your application to Replit, the database in the deployment environment is empty, which means:
- No products are visible
- No supplier data is available
- All application data is missing

## Solution: Data Migration

We've created three tools to help you migrate your data:

1. `export-data.cjs` - Exports data from your local database to a JSON file
2. `import-data.cjs` - Imports data from the JSON file to your deployed database
3. `migrate-data.cjs` - Interactive CLI tool that combines both functions

## Step 1: Export Data from Your Development Environment

1. Ensure your application is running locally with access to your database
2. Set the DATABASE_URL environment variable
3. Run the export tool:

```bash
node export-data.cjs
```

This will create a file called `database-export.json` containing all your data.

## Step 2: Transfer the Export File to Your Deployment

You need to transfer the `database-export.json` file to your Replit deployment.

Option 1: Copy-paste the file content
1. Open the `database-export.json` file in your local environment
2. Select all and copy
3. Create the same file in your Replit deployment and paste the content

Option 2: Upload via the Replit Files panel
1. In Replit's file browser, click on the "three dots" menu
2. Select "Upload file"
3. Upload your `database-export.json` file

## Step 3: Import Data into Your Deployed Database

1. In your Replit deployment, ensure the DATABASE_URL environment variable is set
2. Run the import tool:

```bash
node import-data.cjs
```

This will import all your data into the deployed database.

## Using the Interactive Migration Tool

For a more user-friendly experience, you can use the interactive CLI tool:

```bash
node migrate-data.cjs
```

This tool provides a menu with options to:
1. Export data from database to JSON
2. Import data from JSON to database
3. Show database information
4. Exit

## Troubleshooting

### Missing Tables

If you see errors about missing tables, you may need to run your database migrations first:

```bash
npm run db:push
```

### Database Connection Issues

If you can't connect to the database, check that:
1. The DATABASE_URL environment variable is set correctly
2. The database server is running and accessible
3. Your firewall allows connections to the database port

### Data Import Conflicts

If you encounter primary key conflicts during import, the tool will automatically roll back the transaction to prevent partial imports. You can modify the import script to skip conflicts if needed.

## Important Notes

- The import process will delete all existing data in the target database before importing
- Always take backups before running data migration operations
- Test the import in a staging environment before running it in production
