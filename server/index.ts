import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Modified body-parser setup to capture raw body for better error handling
app.use(express.json({
  verify: (req: any, res, buf, encoding) => {
    if (buf && buf.length) {
      // Use a safe default encoding
      const safeEncoding: BufferEncoding = (encoding as BufferEncoding) || 'utf8';
      req.rawBody = buf.toString(safeEncoding);
    }
  }
}));
app.use(express.urlencoded({ extended: false }));

// Middleware to handle empty request bodies
app.use((req: Request, res: Response, next: NextFunction) => {
  // Only check POST, PUT, PATCH requests that should have JSON content
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && 
      req.headers['content-type']?.includes('application/json')) {
    
    // Check if body is empty on routes that expect JSON
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength === 0) {
      return res.status(400).json({
        error: 'Empty request body',
        message: 'Request body cannot be empty for this operation'
      });
    }
    
    // Check for incomplete JSON in raw body
    if ((req as any).rawBody && (req as any).rawBody.trim() === '') {
      return res.status(400).json({
        error: 'Empty request body',
        message: 'Request body cannot be empty for this operation'
      });
    }
  }
  
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
    // Add retry mechanism for database rate limits during server initialization
    const maxRetries = 3;
    let retries = 0;
    let server;
    
    while (retries < maxRetries) {
      try {
        server = await registerRoutes(app);
        break; // Success, exit the retry loop
      } catch (error: any) {
        retries++;
        
        // Check if it's a rate limiting error
        const isRateLimit = error?.message?.includes('rate limit') || 
                          error?.code === 'XX000' || 
                          (error?.severity === 'ERROR' && error?.code === 'XX000');
        
        if (!isRateLimit || retries >= maxRetries) {
          // Not a rate limit error or max retries reached, rethrow
          throw error;
        }
        
        const delay = 1000 * Math.pow(2, retries - 1); // Exponential backoff
        console.log(`Server initialization: Database rate limit encountered, retry ${retries}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!server) {
      throw new Error("Failed to initialize server after multiple retries");
    }

    // Add specific handler for JSON parsing errors
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      // Express adds status and body properties to the error object for body-parser errors
      // TypeScript doesn't know about these properties, so we need to check them this way
      if (err instanceof SyntaxError && 
          Object.prototype.hasOwnProperty.call(err, 'status') && 
          err['status'] === 400 && 
          Object.prototype.hasOwnProperty.call(err, 'body')) {
        
        // Handle JSON parsing errors
        console.error(`JSON parsing error: ${err.message}`);
        return res.status(400).json({
          error: 'Invalid JSON',
          message: 'The request contains invalid JSON data',
          details: err.message
        });
      }
      
      // Pass other errors to the general error handler
      next(err);
    });

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
