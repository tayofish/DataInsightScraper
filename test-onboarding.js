import { hashPassword } from './server/auth.js';
import { Pool } from 'pg';

async function updateTestUserPassword() {
  try {
    // Hash the password
    const hashedPassword = await hashPassword('test123');
    
    // Connect to database
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    
    // Update the test user's password
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hashedPassword, 'test.newuser']
    );
    
    console.log('Updated test user password:', result.rowCount, 'rows affected');
    
    await pool.end();
  } catch (error) {
    console.error('Error updating password:', error);
  }
}

updateTestUserPassword();