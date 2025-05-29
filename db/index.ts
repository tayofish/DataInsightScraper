import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Simple rate limiter to avoid database rate limiting
class RateLimiter {
  private requestTimes: number[] = [];
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs = 1000, maxRequests = 5) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove old requests
    this.requestTimes = this.requestTimes.filter(time => (now - time) < this.windowMs);
    // Check if we can make a new request
    if (this.requestTimes.length < this.maxRequests) {
      this.requestTimes.push(now);
      return true;
    }
    return false;
  }

  async waitForAvailability(): Promise<void> {
    return new Promise(resolve => {
      const checkAndResolve = () => {
        if (this.canMakeRequest()) {
          resolve();
        } else {
          setTimeout(checkAndResolve, 100);
        }
      };
      checkAndResolve();
    });
  }
}

// Create global rate limiter instance - further reduced to avoid rate limits
export const dbRateLimiter = new RateLimiter(2000, 2); // 2 requests per 2 seconds to be extra conservative

// Configure pool with connection retry and timeout settings - optimized for rate limiting
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 2, // Minimize concurrent connections to avoid rate limiting
  idleTimeoutMillis: 60000, // Keep connections alive longer to reduce reconnects
  connectionTimeoutMillis: 8000, // Extended timeout for slower connections
  maxUses: 25, // Further reduce client reuse to avoid connection issues
  allowExitOnIdle: true
});

// Log connection errors
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Drizzle ORM instance with connection pooling
export const db = drizzle({ client: pool, schema });

// Function to test database connection with exponential backoff
// Global query cache to reduce database hits
const queryCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_TTL = 60000; // 1 minute cache TTL

// Execute a query with retries and caching
export async function executeQueryWithRetry<T>(
  query: string, 
  params: any[] = [], 
  options: {
    cacheKey?: string, 
    maxRetries?: number,
    cacheTTL?: number
  } = {}
): Promise<T> {
  const { 
    cacheKey, 
    maxRetries = 5,
    cacheTTL = CACHE_TTL
  } = options;
  
  // Try to return from cache if cacheKey is provided
  if (cacheKey) {
    const cached = queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < cacheTTL) {
      console.log(`Using cached result for query: ${cacheKey}`);
      return cached.data as T;
    }
  }
  
  let retries = 0;
  let lastError: any;
  
  while (retries < maxRetries) {
    try {
      // Wait for rate limiter if needed
      await dbRateLimiter.waitForAvailability();
      
      // Execute query
      const result = await pool.query(query, params);
      
      // Cache result if cacheKey provided
      if (cacheKey) {
        queryCache.set(cacheKey, {
          data: result.rows,
          timestamp: Date.now()
        });
      }
      
      return result.rows as T;
    } catch (error: any) {
      lastError = error;
      retries++;
      
      // Check for rate limiting errors
      if (error.message && (
          error.message.includes('rate limit') || 
          error.message.includes('Control plane')
      )) {
        console.warn(`Database rate limit hit, attempt ${retries}/${maxRetries}`);
      } else {
        console.error(`Query error (attempt ${retries}/${maxRetries}):`, error);
      }
      
      if (retries >= maxRetries) {
        console.error('Max database query retries reached.');
        throw lastError;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retries), 10000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export async function testDatabaseConnection(maxRetries = 5) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Simple query to test connection
      await pool.query('SELECT 1');
      console.log('Database connection successful');
      return true;
    } catch (error) {
      retries++;
      const delay = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff up to 10 seconds
      console.error(`Database connection attempt ${retries} failed. Retrying in ${delay}ms...`, error);
      
      if (retries >= maxRetries) {
        console.error('Max database connection retries reached.');
        return false;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return false;
}