import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 10000;
process.env.NODE_ENV = 'production';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'dist', 'public');

const app = express();
app.use(express.json());

console.log(`✅ Starting app on port ${PORT}`);
console.log(`Serving public assets from: ${publicPath}`);

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Safe ISO timestamp
const safeDate = () => new Date().toISOString();

// API endpoints (same as before)
app.get('/api/user/profile', (req, res) => {
  res.json({
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    createdAt: safeDate(),
    updatedAt: safeDate()
  });
});

// (Add your other API endpoints here - same as your current script)
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    productCount: 1601,
    displayCount: 1601,
    syncedProducts: 1601,
    lastSync: safeDate(),
    updatedAt: safeDate(),
    storeUrl: '6c8940-3.myshopify.com',
    syncInProgress: false
  });
});

app.get('/api/*', (req, res) => {
  res.json({
    status: 'ok',
    endpoint: req.path,
    timestamp: safeDate()
  });
});

// Prevent caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static files
app.use(express.static(publicPath));

// Handle SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
