// Production-specific debug script to identify block/unblock issues
const { Pool } = require('pg');

async function debugProductionBlock() {
  console.log("=== Production Block Functionality Debug ===");
  
  // Use your production database connection string
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://taskscout_una:6qsX7ptGPiA1@10.15.0.29:5432/monitoring'
  });

  try {
    const client = await pool.connect();
    
    // 1. Check if pool and database connection work
    console.log("1. Testing database connection...");
    const connTest = await client.query('SELECT NOW() as timestamp, current_database() as db_name');
    console.log(`   ✓ Connected to database: ${connTest.rows[0].db_name} at ${connTest.rows[0].timestamp}`);
    
    // 2. Verify users table structure matches expectations
    console.log("\n2. Verifying users table structure...");
    const tableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('id', 'is_blocked', 'is_admin', 'username', 'name')
      ORDER BY ordinal_position
    `);
    
    console.log("   Table structure:");
    tableCheck.rows.forEach(col => {
      console.log(`     ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 3. Check for admin users in production
    console.log("\n3. Checking admin users...");
    const adminUsers = await client.query(`
      SELECT id, username, name, is_admin, is_blocked 
      FROM users 
      WHERE is_admin = true 
      ORDER BY id
    `);
    
    if (adminUsers.rows.length === 0) {
      console.log("   ❌ No admin users found - this could cause authentication issues");
    } else {
      console.log("   ✓ Admin users found:");
      adminUsers.rows.forEach(admin => {
        console.log(`     ID ${admin.id}: ${admin.name} (${admin.username}) - Blocked: ${admin.is_blocked}`);
      });
    }
    
    // 4. Test the exact SQL that the storage function uses
    console.log("\n4. Testing storage function SQL operations...");
    
    // Find a test user (non-admin)
    const testUsers = await client.query(`
      SELECT id, username, name, is_blocked 
      FROM users 
      WHERE is_admin = false 
      ORDER BY id 
      LIMIT 1
    `);
    
    if (testUsers.rows.length === 0) {
      console.log("   ❌ No non-admin users found for testing");
    } else {
      const testUser = testUsers.rows[0];
      console.log(`   Testing with user: ${testUser.name} (ID: ${testUser.id})`);
      
      // Test the exact query from storage function
      console.log("   Testing SELECT query...");
      const selectResult = await client.query(
        'SELECT id, username, name, is_blocked FROM users WHERE id = $1', 
        [testUser.id]
      );
      console.log(`   ✓ SELECT works: found user ${selectResult.rows[0].name}`);
      
      // Test UPDATE query (without actually changing anything)
      console.log("   Testing UPDATE query structure...");
      const currentStatus = selectResult.rows[0].is_blocked;
      
      try {
        const updateResult = await client.query(
          'UPDATE users SET is_blocked = $1 WHERE id = $2 RETURNING id, username, name, email, avatar, is_admin, is_approved, is_blocked, department_id',
          [currentStatus, testUser.id] // Set to same value to avoid actual change
        );
        
        if (updateResult.rows.length > 0) {
          console.log(`   ✓ UPDATE query works: returns ${updateResult.rows.length} row(s)`);
        } else {
          console.log("   ❌ UPDATE query failed: no rows returned");
        }
      } catch (updateError) {
        console.log(`   ❌ UPDATE query failed: ${updateError.message}`);
        console.log(`   Error code: ${updateError.code}`);
      }
    }
    
    // 5. Check session table for authentication debugging
    console.log("\n5. Checking session storage...");
    try {
      const sessionTableCheck = await client.query(`
        SELECT COUNT(*) as session_count 
        FROM session 
        WHERE expire > NOW()
      `);
      console.log(`   ✓ Active sessions: ${sessionTableCheck.rows[0].session_count}`);
    } catch (sessionError) {
      console.log(`   ❌ Session table issue: ${sessionError.message}`);
    }
    
    // 6. Test the pool connection that the application uses
    console.log("\n6. Testing connection pool...");
    try {
      const poolClient = await pool.connect();
      const poolTest = await poolClient.query('SELECT 1 as test');
      console.log("   ✓ Pool connection works");
      poolClient.release();
    } catch (poolError) {
      console.log(`   ❌ Pool connection failed: ${poolError.message}`);
    }
    
    client.release();
    console.log("\n=== Debug Complete ===");
    
  } catch (error) {
    console.error("❌ Debug failed:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
  } finally {
    await pool.end();
  }
}

// Run the debug
debugProductionBlock().catch(console.error);