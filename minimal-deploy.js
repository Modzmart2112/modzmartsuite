#!/usr/bin/env node

/**
 * Minimal Deployment Script
 * Absolute minimal version to establish a baseline
 */

import express from 'express';

// Create minimal express app
const app = express();

// Health check endpoint
app.get('/', (req, res) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Minimal server running on port ${port}`);
});