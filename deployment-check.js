#!/usr/bin/env node

/**
 * Deployment Readiness Check Script
 * 
 * This script verifies that all prerequisites for deployment are met.
 * Run this before deploying to ensure a smooth deployment process.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Initialize
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let allPassed = true;

console.log('\n=================================================');
console.log('DEPLOYMENT READINESS CHECK');
console.log('=================================================\n');

// Helper function for check results
function logCheck(name, passed, message, details = null) {
  if (passed) {
    console.log(`✅ ${name}: ${message}`);
  } else {
    console.log(`❌ ${name}: ${message}`);
    if (details) {
      console.log(`   ${details}`);
    }
    allPassed = false;
  }
}

// Check 1: Required files exist
function checkRequiredFiles() {
  const requiredFiles = [
    'reliable-deploy.js',
    'dist/index.js',
    'dist/public/index.html'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    logCheck(
      `Required file: ${file}`,
      exists,
      exists ? 'Found' : 'Missing',
      !exists ? 'Run "npm run build" to generate dist files' : null
    );
  }
}

// Check 2: Environment variables
function checkEnvironmentVariables() {
  const requiredVars = [
    'SHOPIFY_ACCESS_TOKEN',
    'SHOPIFY_API_KEY',
    'SHOPIFY_STORE_URL',
    'DATABASE_URL'
  ];
  
  for (const variable of requiredVars) {
    const exists = !!process.env[variable];
    logCheck(
      `Environment variable: ${variable}`,
      exists,
      exists ? 'Set' : 'Missing',
      !exists ? 'Set this in your Replit Secrets panel' : null
    );
  }
}

// Check 3: Package.json build script
function checkBuildScript() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const hasBuildScript = packageJson.scripts && packageJson.scripts.build;
    logCheck(
      'Build script',
      hasBuildScript,
      hasBuildScript ? 'Found in package.json' : 'Missing from package.json',
      !hasBuildScript ? 'Add a "build" script to package.json' : null
    );
  } catch (error) {
    logCheck('package.json', false, 'Error reading package.json', error.message);
  }
}

// Check 4: Check for unsaved files
function checkUnsavedFiles() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf8' });
    const hasUnsavedChanges = output.trim().length > 0;
    logCheck(
      'Unsaved changes',
      !hasUnsavedChanges,
      hasUnsavedChanges ? 'Unsaved changes detected' : 'No unsaved changes',
      hasUnsavedChanges ? 'Commit all changes before deploying' : null
    );
  } catch (error) {
    logCheck('Git status', false, 'Error checking git status', error.message);
  }
}

// Check 5: Node.js version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  const isCompatible = major >= 16;
  logCheck(
    'Node.js version',
    isCompatible,
    `Using Node.js ${version}`,
    !isCompatible ? 'Node.js 16 or higher is recommended' : null
  );
}

// Check 6: Deployment scripts executable
function checkExecutableScripts() {
  const scripts = [
    'reliable-deploy.js',
    'replit-production.js',
    'production.js'
  ];
  
  for (const script of scripts) {
    try {
      const filePath = path.join(__dirname, script);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const isExecutable = !!(stats.mode & 0o111);
        logCheck(
          `Executable permissions: ${script}`,
          isExecutable,
          isExecutable ? 'Is executable' : 'Not executable',
          !isExecutable ? `Run "chmod +x ${script}" to make it executable` : null
        );
      }
    } catch (error) {
      // Skip if file doesn't exist
    }
  }
}

// Check 7: Deployment target set
function checkDeploymentTarget() {
  const targetFile = path.join(__dirname, '.replit.deploymentTarget');
  let targetSet = false;
  let targetScript = '';
  
  if (fs.existsSync(targetFile)) {
    try {
      targetScript = fs.readFileSync(targetFile, 'utf8').trim();
      targetSet = targetScript.includes('reliable-deploy.js');
    } catch (error) {
      // Ignore read errors
    }
  }
  
  logCheck(
    'Deployment target',
    targetSet,
    targetSet ? `Set to use ${targetScript}` : 'Not set correctly',
    !targetSet ? 'Make sure .replit.deploymentTarget contains "node reliable-deploy.js"' : null
  );
}

// Run all checks
checkRequiredFiles();
checkEnvironmentVariables();
checkBuildScript();
checkUnsavedFiles();
checkNodeVersion();
checkExecutableScripts();
checkDeploymentTarget();

// Summary
console.log('\n=================================================');
if (allPassed) {
  console.log('✅ ALL CHECKS PASSED - Ready for deployment!');
} else {
  console.log('❌ SOME CHECKS FAILED - Fix issues before deploying');
}
console.log('=================================================\n');

// Exit with appropriate code
process.exit(allPassed ? 0 : 1);