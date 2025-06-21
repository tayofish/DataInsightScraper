const { Pool } = require('pg');

async function testUnitHeadEmailSetup() {
  console.log('Testing Unit Head Email Configuration...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check which units have unit heads assigned
    console.log('1. Checking units with assigned unit heads:');
    const unitsQuery = `
      SELECT d.id, d.name, d.department_head_id, u.username, u.name as user_name, u.email
      FROM departments d
      LEFT JOIN users u ON u.id = d.department_head_id
      WHERE d.department_head_id IS NOT NULL;
    `;
    
    const unitsResult = await pool.query(unitsQuery);
    
    if (unitsResult.rows.length === 0) {
      console.log('❌ No units found with assigned unit heads');
      return;
    }
    
    unitsResult.rows.forEach(unit => {
      console.log(`✓ Unit: ${unit.name} (ID: ${unit.id})`);
      console.log(`  Unit Head: ${unit.user_name} (${unit.username})`);
      console.log(`  Email: ${unit.email}`);
      console.log('');
    });

    // Check if unit head notifications are enabled
    console.log('2. Checking notification settings:');
    const settingsQuery = `
      SELECT key, value 
      FROM app_settings 
      WHERE key IN ('end_of_day_unit_head_notifications', 'end_of_day_admin_notifications');
    `;
    
    const settingsResult = await pool.query(settingsQuery);
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    console.log(`Unit Head Notifications: ${settings.end_of_day_unit_head_notifications === 'true' ? '✓ Enabled' : '❌ Disabled'}`);
    console.log(`Admin Notifications: ${settings.end_of_day_admin_notifications === 'true' ? '✓ Enabled' : '❌ Disabled'}`);

    // Check if there are tasks for the unit to report
    console.log('\n3. Checking task activity for Database Unit (ID: 13):');
    
    const taskQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('todo', 'in_progress') AND due_date < CURRENT_DATE) as overdue_count,
        COUNT(*) FILTER (WHERE status IN ('todo', 'in_progress')) as pending_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= CURRENT_DATE) as completed_today
      FROM tasks 
      WHERE department_id = 13;
    `;
    
    const taskResult = await pool.query(taskQuery);
    const taskStats = taskResult.rows[0];
    
    console.log(`Overdue tasks: ${taskStats.overdue_count}`);
    console.log(`Pending tasks: ${taskStats.pending_count}`);
    console.log(`Completed today: ${taskStats.completed_today}`);
    
    // Determine if email would be sent
    const hasActivity = parseInt(taskStats.overdue_count) > 0 || 
                       parseInt(taskStats.pending_count) > 0 || 
                       parseInt(taskStats.completed_today) > 0;
    
    console.log(`\n4. Email would be sent: ${hasActivity ? '✓ Yes (has activity)' : '❌ No (no activity)'}`);

    // Check SMTP configuration
    console.log('\n5. Checking SMTP configuration:');
    const smtpQuery = `SELECT active, host, from_email FROM smtp_config WHERE active = true LIMIT 1;`;
    const smtpResult = await pool.query(smtpQuery);
    
    if (smtpResult.rows.length > 0) {
      console.log(`✓ SMTP configured: ${smtpResult.rows[0].host}`);
      console.log(`✓ From email: ${smtpResult.rows[0].from_email}`);
    } else {
      console.log('❌ No active SMTP configuration found');
    }

    console.log('\n=== SUMMARY ===');
    console.log('The fix has been implemented to use the departments table instead of units table for unit head lookups.');
    console.log('Tom Cook should now receive unit head notifications for Database Unit when:');
    console.log('- Unit head notifications are enabled');
    console.log('- The unit has task activity (overdue, pending, or completed tasks)');
    console.log('- SMTP is properly configured');

  } catch (error) {
    console.error('Error testing unit head email setup:', error);
  } finally {
    await pool.end();
  }
}

testUnitHeadEmailSetup();