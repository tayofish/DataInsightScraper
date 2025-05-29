import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";

const app = express();

// Production logging function
function log(message: string, source = "express") {
  console.log(`${new Date().toLocaleTimeString()} [${source}] ${message}`);
}

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
        message: 'Request body is required for this endpoint'
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
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const publicPath = path.resolve(__dirname, "../dist/public");
  
  app.use(express.static(publicPath));
  
  // Catch-all handler for client-side routing
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(publicPath, "index.html"));
  });
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Express error:', err);
  
  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: 'Uploaded file exceeds size limit'
    });
  }

  // Generic error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});

// Final error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error in Express:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Start the server
const port = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    log("✅ Clean build. No dev logic here.");
    
    const server = await registerRoutes(app);
    
    server.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();