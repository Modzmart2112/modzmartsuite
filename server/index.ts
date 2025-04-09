import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { scheduler, checkAllPrices, scheduledSyncShopifyProducts, fixSilRp016Price } from "./scheduler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start the price check scheduler - run once daily at midnight
    const now = new Date();
    const tonight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // tomorrow
      0, 0, 0 // at midnight (00:00:00)
    );
    const msUntilMidnight = tonight.getTime() - now.getTime();
    
    // First run: schedule for next midnight
    setTimeout(() => {
      // Execute job
      checkAllPrices().catch(err => console.error('Error in initial price check:', err));
      
      // Then schedule to run every 24 hours
      scheduler.startJob('daily-price-check', 86400000, checkAllPrices);
      log('Price check scheduler set to run daily at midnight', 'scheduler');
    }, msUntilMidnight);
    
    log(`Price check scheduler initialized - first run in ${Math.round(msUntilMidnight/3600000)} hours at midnight`, 'scheduler');
    
    // Start our specialized job to fix the SIL-RP-016 price
    // Run immediately first, then every 15 minutes
    fixSilRp016Price().catch(err => console.error('Error in price fix job:', err));
    scheduler.startJob('fix-sil-rp-016-price', 15 * 60 * 1000, fixSilRp016Price);
    log(`Started price fix job for SIL-RP-016 - runs every 15 minutes`, 'scheduler');
    
    // Shopify sync is now manual only - no automatic scheduling
    log(`Shopify sync is set to manual mode - will only run when triggered by the user`, 'scheduler');
    
    // Commented out the automatic sync
    // const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
    // Run immediately on startup
    // scheduledSyncShopifyProducts().catch(err => console.error('Error in initial Shopify sync:', err));
    // Then schedule to run every hour
    // scheduler.startJob('hourly-shopify-sync', ONE_HOUR, scheduledSyncShopifyProducts);
  });
})();
