// Diagnostic script to test block functionality in production environment
const { Pool } = require('pg');

async function diagnoseBlockFunctionality() {
  console.log("=== Production Block Functionality Diagnosis ===");
  
  // Use production database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://taskscout_una:6qsX7ptGPiA1@10.15.0.29:5432/monitoring'
  });

  try {
    const client = await pool.connect();
    
    // Test 1: Check database connection
    console.log("1. Testing database connection...");
    const connectionTest = await client.query('SELECT NOW() as current_time');
    console.log("✓ Database connected successfully:", connectionTest.rows[0]);
    
    // Test 2: Check users table structure
    console.log("\n2. Checking users table structure...");
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    console.log("✓ Users table columns:");
    tableStructure.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Test 3: Check if is_blocked column exists and is accessible
    console.log("\n3. Testing is_blocked column accessibility...");
    const columnTest = await client.query(`
      SELECT id, username, name, is_blocked, is_admin 
      FROM users 
      WHERE id IN (16, 17, 18, 20, 21) 
      LIMIT 5
    `);
    console.log("✓ Sample users with is_blocked status:");
    columnTest.rows.forEach(user => {
      console.log(`   ID ${user.id}: ${user.name} - blocked: ${user.is_blocked}, admin: ${user.is_admin}`);
    });
    
    // Test 4: Try to update a user's blocked status (dry run)
    console.log("\n4. Testing UPDATE operation (dry run with user ID 21)...");
    
    // First, get current status
    const beforeUpdate = await client.query('SELECT id, username, name, is_blocked FROM users WHERE id = 21');
    if (beforeUpdate.rows.length > 0) {
      const user = beforeUpdate.rows[0];
      console.log(`   Before: ${user.name} (${user.username}) - blocked: ${user.is_blocked}`);
      
      // Try the update
      const updateResult = await client.query(
        'UPDATE users SET is_blocked = true WHERE id = 21 RETURNING id, username, name, is_blocked'
      );
      
      if (updateResult.rows.length > 0) {
        const updated = updateResult.rows[0];
        console.log(`   ✓ Update successful: ${updated.name} - blocked: ${updated.is_blocked}`);
        
        // Revert the change
        await client.query('UPDATE users SET is_blocked = false WHERE id = 21');
        console.log(`   ✓ Reverted change successfully`);
      } else {
        console.log("   ✗ Update failed - no rows returned");
      }
    } else {
      console.log("   ✗ User ID 21 not found");
    }
    
    // Test 5: Check for any constraints or triggers
    console.log("\n5. Checking for constraints on users table...");
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users'
    `);
    console.log("✓ Table constraints:");
    constraints.rows.forEach(constraint => {
      console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type}`);
    });
    
    client.release();
    console.log("\n=== Diagnosis Complete ===");
    
  } catch (error) {
    console.error("❌ Diagnosis failed:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
  } finally {
    await pool.end();
  }
}

// Run the diagnosis
diagnoseBlockFunctionality().catch(console.error);