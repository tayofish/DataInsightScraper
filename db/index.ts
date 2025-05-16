import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with connection retry and timeout settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5, // Limit concurrent connections 
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Connection timeout after 5 seconds
  maxUses: 100, // How many times a client can be used before it's destroyed
  allowExitOnIdle: true
});

// Log connection errors
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Drizzle ORM instance with connection pooling
export const db = drizzle({ client: pool, schema });

// Function to test database connection with exponential backoff
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