// Production-specific block/unblock implementation to handle potential ORM issues
const { Pool } = require('pg');

// Use your production database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://taskscout_una:6qsX7ptGPiA1@10.15.0.29:5432/monitoring'
});

async function blockUserProduction(userId) {
  console.log(`Production blockUser: Starting with user ID: ${userId}`);
  
  try {
    const client = await pool.connect();
    
    // First check if user exists
    const checkResult = await client.query('SELECT id, username, name, is_blocked FROM users WHERE id = $1', [userId]);
    console.log('Production blockUser: User lookup result:', checkResult.rows);
    
    if (checkResult.rows.length === 0) {
      console.log('Production blockUser: User not found');
      client.release();
      return null;
    }
    
    // Update the user to blocked
    const updateResult = await client.query(
      'UPDATE users SET is_blocked = true WHERE id = $1 RETURNING id, username, name, is_blocked, is_admin',
      [userId]
    );
    
    console.log('Production blockUser: Update result:', updateResult.rows);
    client.release();
    
    return updateResult.rows[0];
  } catch (error) {
    console.error('Production blockUser: Database error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    throw error;
  }
}

async function unblockUserProduction(userId) {
  console.log(`Production unblockUser: Starting with user ID: ${userId}`);
  
  try {
    const client = await pool.connect();
    
    // First check if user exists
    const checkResult = await client.query('SELECT id, username, name, is_blocked FROM users WHERE id = $1', [userId]);
    console.log('Production unblockUser: User lookup result:', checkResult.rows);
    
    if (checkResult.rows.length === 0) {
      console.log('Production unblockUser: User not found');
      client.release();
      return null;
    }
    
    // Update the user to unblocked
    const updateResult = await client.query(
      'UPDATE users SET is_blocked = false WHERE id = $1 RETURNING id, username, name, is_blocked, is_admin',
      [userId]
    );
    
    console.log('Production unblockUser: Update result:', updateResult.rows);
    client.release();
    
    return updateResult.rows[0];
  } catch (error) {
    console.error('Production unblockUser: Database error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    throw error;
  }
}

module.exports = {
  blockUserProduction,
  unblockUserProduction
};