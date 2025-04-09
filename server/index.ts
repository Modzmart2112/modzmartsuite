import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSchedulers } from "./scheduler";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check endpoint - only in production
if (process.env.NODE_ENV === 'production') {
  app.get('/', (req, res) => {
    res.status(200).send('Health check OK');
  });
}

// Serve the uploads directory directly to fix profile picture loading issues
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Log any requests to /uploads to help debug profile picture issues
app.use('/uploads', (req, res, next) => {
  console.log(`Debug - Static file request: ${req.url}`);
  next();
});

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

// Setup application
async function setupApp() {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error('Express ERROR:', err);
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Setup schedulers independently
  setupSchedulers();

  return server;
}

// Development mode
// Always start the server regardless of environment
// This ensures that both development and production will work
setupApp().then(server => {
  const port = process.env.PORT || 5000;
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`Server running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  console.error(err.stack); // Print stack trace for better debugging
  process.exit(1);
});

// Export for production
export default setupApp;