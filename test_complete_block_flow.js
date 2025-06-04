// Complete test of authentication + block functionality
const { Pool } = require('pg');

async function testCompleteBlockFlow() {
  console.log("=== Complete Block/Unblock Flow Test ===");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://taskscout_una:6qsX7ptGPiA1@10.15.0.29:5432/monitoring'
  });

  try {
    const client = await pool.connect();
    
    // Test 1: Verify admin user exists and has correct permissions
    console.log("\n1. Checking admin user permissions...");
    const adminCheck = await client.query(`
      SELECT id, username, name, is_admin, is_blocked, is_approved 
      FROM users 
      WHERE is_admin = true 
      ORDER BY id 
      LIMIT 5
    `);
    
    if (adminCheck.rows.length === 0) {
      console.log("❌ No admin users found in database");
      return;
    }
    
    console.log("✓ Admin users found:");
    adminCheck.rows.forEach(admin => {
      console.log(`   ID ${admin.id}: ${admin.name} (${admin.username}) - Admin: ${admin.is_admin}, Blocked: ${admin.is_blocked}`);
    });
    
    // Test 2: Verify target user exists for blocking
    console.log("\n2. Checking target users for blocking test...");
    const targetUsers = await client.query(`
      SELECT id, username, name, is_admin, is_blocked, is_approved 
      FROM users 
      WHERE is_admin = false 
      ORDER BY id 
      LIMIT 3
    `);
    
    if (targetUsers.rows.length === 0) {
      console.log("❌ No non-admin users found for testing");
      return;
    }
    
    console.log("✓ Target users available:");
    targetUsers.rows.forEach(user => {
      console.log(`   ID ${user.id}: ${user.name} (${user.username}) - Blocked: ${user.is_blocked}`);
    });
    
    // Test 3: Simulate the exact block operation that happens in the API
    const testUserId = targetUsers.rows[0].id;
    console.log(`\n3. Testing block operation on user ID ${testUserId}...`);
    
    // Get current status
    const beforeBlock = await client.query('SELECT id, username, name, is_blocked FROM users WHERE id = $1', [testUserId]);
    console.log(`   Before: ${beforeBlock.rows[0].name} - blocked: ${beforeBlock.rows[0].is_blocked}`);
    
    // Perform block (same as storage function)
    const blockResult = await client.query(
      'UPDATE users SET is_blocked = true WHERE id = $1 RETURNING id, username, name, email, avatar, is_admin, is_approved, is_blocked, department_id',
      [testUserId]
    );
    
    if (blockResult.rows.length > 0) {
      console.log(`   ✓ Block successful: ${blockResult.rows[0].name} - blocked: ${blockResult.rows[0].is_blocked}`);
    } else {
      console.log("   ❌ Block operation failed - no rows returned");
    }
    
    // Test 4: Verify block took effect
    console.log("\n4. Verifying block status...");
    const verifyBlock = await client.query('SELECT id, username, name, is_blocked FROM users WHERE id = $1', [testUserId]);
    const isBlocked = verifyBlock.rows[0].is_blocked;
    
    if (isBlocked) {
      console.log(`   ✓ Block verified: User is correctly blocked`);
    } else {
      console.log(`   ❌ Block verification failed: User is not blocked`);
    }
    
    // Test 5: Test unblock operation
    console.log("\n5. Testing unblock operation...");
    const unblockResult = await client.query(
      'UPDATE users SET is_blocked = false WHERE id = $1 RETURNING id, username, name, email, avatar, is_admin, is_approved, is_blocked, department_id',
      [testUserId]
    );
    
    if (unblockResult.rows.length > 0) {
      console.log(`   ✓ Unblock successful: ${unblockResult.rows[0].name} - blocked: ${unblockResult.rows[0].is_blocked}`);
    } else {
      console.log("   ❌ Unblock operation failed - no rows returned");
    }
    
    // Test 6: Final verification
    console.log("\n6. Final verification...");
    const finalCheck = await client.query('SELECT id, username, name, is_blocked FROM users WHERE id = $1', [testUserId]);
    const finalStatus = finalCheck.rows[0].is_blocked;
    
    if (!finalStatus) {
      console.log(`   ✓ Unblock verified: User is correctly unblocked`);
    } else {
      console.log(`   ❌ Unblock verification failed: User is still blocked`);
    }
    
    // Test 7: Check session store for authentication issues
    console.log("\n7. Checking session store...");
    const sessionCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'session'
    `);
    
    if (sessionCheck.rows.length > 0) {
      const sessionCount = await client.query('SELECT COUNT(*) as count FROM session');
      console.log(`   ✓ Session table exists with ${sessionCount.rows[0].count} sessions`);
    } else {
      console.log(`   ❌ Session table not found - authentication may not work`);
    }
    
    client.release();
    console.log("\n=== Test Complete ===");
    
  } catch (error) {
    console.error("❌ Test failed:", {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
  } finally {
    await pool.end();
  }
}

// Run the test
testCompleteBlockFlow().catch(console.error);