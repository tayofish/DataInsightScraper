// Production-specific block/unblock fix for your server environment
const { Pool } = require('pg');

// Direct database connection using your production credentials
const pool = new Pool({
  connectionString: 'postgresql://taskscout_una:6qsX7ptGPiA1@10.15.0.29:5432/monitoring'
});

async function blockUserProduction(userId) {
  console.log(`\n=== Blocking User ID ${userId} ===`);
  
  try {
    const client = await pool.connect();
    
    // Get user info before blocking
    const beforeResult = await client.query(
      'SELECT id, username, name, is_blocked FROM users WHERE id = $1',
      [userId]
    );
    
    if (beforeResult.rows.length === 0) {
      console.log(`❌ User ID ${userId} not found`);
      client.release();
      return null;
    }
    
    const user = beforeResult.rows[0];
    console.log(`User found: ${user.name} (${user.username}) - Currently blocked: ${user.is_blocked}`);
    
    // Perform the block operation
    const blockResult = await client.query(
      'UPDATE users SET is_blocked = true WHERE id = $1 RETURNING id, username, name, is_blocked',
      [userId]
    );
    
    if (blockResult.rows.length > 0) {
      const blockedUser = blockResult.rows[0];
      console.log(`✓ User blocked successfully: ${blockedUser.name} - Blocked: ${blockedUser.is_blocked}`);
      client.release();
      return blockedUser;
    } else {
      console.log(`❌ Block operation failed - no rows updated`);
      client.release();
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error blocking user ${userId}:`, {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return null;
  }
}

async function unblockUserProduction(userId) {
  console.log(`\n=== Unblocking User ID ${userId} ===`);
  
  try {
    const client = await pool.connect();
    
    // Get user info before unblocking
    const beforeResult = await client.query(
      'SELECT id, username, name, is_blocked FROM users WHERE id = $1',
      [userId]
    );
    
    if (beforeResult.rows.length === 0) {
      console.log(`❌ User ID ${userId} not found`);
      client.release();
      return null;
    }
    
    const user = beforeResult.rows[0];
    console.log(`User found: ${user.name} (${user.username}) - Currently blocked: ${user.is_blocked}`);
    
    // Perform the unblock operation
    const unblockResult = await client.query(
      'UPDATE users SET is_blocked = false WHERE id = $1 RETURNING id, username, name, is_blocked',
      [userId]
    );
    
    if (unblockResult.rows.length > 0) {
      const unblockedUser = unblockResult.rows[0];
      console.log(`✓ User unblocked successfully: ${unblockedUser.name} - Blocked: ${unblockedUser.is_blocked}`);
      client.release();
      return unblockedUser;
    } else {
      console.log(`❌ Unblock operation failed - no rows updated`);
      client.release();
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error unblocking user ${userId}:`, {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return null;
  }
}

// Test with a user ID if provided as command line argument
if (process.argv[2]) {
  const userId = parseInt(process.argv[2]);
  const action = process.argv[3] || 'block';
  
  if (action === 'block') {
    blockUserProduction(userId).then(() => process.exit(0)).catch(console.error);
  } else if (action === 'unblock') {
    unblockUserProduction(userId).then(() => process.exit(0)).catch(console.error);
  } else {
    console.log('Usage: node production_block_fix.js <user_id> [block|unblock]');
    process.exit(1);
  }
} else {
  console.log('Production block/unblock functions ready');
  console.log('Usage: node production_block_fix.js <user_id> [block|unblock]');
}

module.exports = { blockUserProduction, unblockUserProduction };