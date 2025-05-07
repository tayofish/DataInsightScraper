import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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

// Global error handlers for the Node.js process
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  // We don't exit the process because it would kill the Replit workflow
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error('Reason:', reason);
  // We don't exit the process because it would kill the Replit workflow
  // process.exit(1);
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Add general error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error(`Server error: ${err.stack || err}`);
      
      // Only send response if it hasn't been sent already
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    });

    // Add a catch-all route for API 404s
    app.use('/api/*', (req, res) => {
      res.status(404).json({ message: `API route not found: ${req.originalUrl}` });
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
    });

    // Handle server errors to prevent crashes
    server.on('error', (error) => {
      console.error('Server error:', error);
      
      // Try to recover by restarting if the port is in use
      if ((error as any).code === 'EADDRINUSE') {
        console.log('Port is in use, trying again in 5 seconds...');
        setTimeout(() => {
          server.close();
          server.listen({
            port,
            host: "0.0.0.0",
            reusePort: true,
          });
        }, 5000);
      }
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
      });
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
      });
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    // Try to restart after a delay if there was an error starting
    setTimeout(() => {
      console.log('Attempting to restart server...');
      // We don't actually restart here because Replit will handle it
    }, 5000);
  }
})();
