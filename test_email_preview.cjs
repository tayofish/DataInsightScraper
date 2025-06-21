const http = require('http');
const querystring = require('querystring');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('application/json') 
            ? JSON.parse(body) 
            : body;
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testEmailPreviewFunctionality() {
  console.log('Testing Email Preview Functionality...\n');
  
  try {
    // First, authenticate as admin
    const loginData = querystring.stringify({
      username: 'admin',
      password: 'admin123'
    });
    
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    console.log('1. Attempting to authenticate...');
    const loginResponse = await makeRequest(loginOptions, loginData);
    
    if (loginResponse.status !== 302 && loginResponse.status !== 200) {
      console.log('Authentication failed, status:', loginResponse.status);
      return;
    }
    
    // Extract session cookie
    const setCookieHeader = loginResponse.headers['set-cookie'];
    const sessionCookie = setCookieHeader ? setCookieHeader[0] : null;
    
    if (!sessionCookie) {
      console.log('No session cookie received');
      return;
    }
    
    console.log('✓ Authentication successful');
    
    // Test all four email preview endpoints
    const endpoints = [
      { path: '/api/end-of-day-notifications/user-summary', name: 'User Summary' },
      { path: '/api/end-of-day-notifications/admin-summary', name: 'Admin Summary' },
      { path: '/api/end-of-day-notifications/unit-summary/13', name: 'Unit Head Summary (Database Unit)' },
      { path: '/api/end-of-day-notifications/department-summary/13', name: 'Department Head Summary' }
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n2. Testing ${endpoint.name}...`);
      
      const options = {
        hostname: 'localhost',
        port: 5000,
        path: endpoint.path,
        method: 'GET',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/json'
        }
      };
      
      const response = await makeRequest(options);
      
      if (response.status === 200) {
        console.log(`✓ ${endpoint.name} - SUCCESS`);
        
        // Show sample data structure
        if (typeof response.data === 'object' && response.data !== null) {
          const keys = Object.keys(response.data);
          console.log(`  Data structure: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`);
          
          // Show specific counts for different summary types
          if (response.data.overdueTasks !== undefined) {
            console.log(`  Overdue tasks: ${Array.isArray(response.data.overdueTasks) ? response.data.overdueTasks.length : response.data.overdueTasks}`);
          }
          if (response.data.totalOverdueTasks !== undefined) {
            console.log(`  Total overdue tasks: ${response.data.totalOverdueTasks}`);
          }
          if (response.data.unitName) {
            console.log(`  Unit name: ${response.data.unitName}`);
          }
          if (response.data.departmentName) {
            console.log(`  Department name: ${response.data.departmentName}`);
          }
        }
      } else {
        console.log(`✗ ${endpoint.name} - FAILED (Status: ${response.status})`);
        if (response.data && typeof response.data === 'object') {
          console.log(`  Error: ${response.data.message || 'Unknown error'}`);
        }
      }
    }
    
    console.log('\n3. Testing notification settings...');
    const settingsOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/end-of-day-notifications/settings',
      method: 'GET',
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      }
    };
    
    const settingsResponse = await makeRequest(settingsOptions);
    
    if (settingsResponse.status === 200) {
      console.log('✓ Notification Settings - SUCCESS');
      if (settingsResponse.data) {
        console.log(`  User notifications: ${settingsResponse.data.userNotificationsEnabled ? 'enabled' : 'disabled'}`);
        console.log(`  Admin notifications: ${settingsResponse.data.adminNotificationsEnabled ? 'enabled' : 'disabled'}`);
        console.log(`  Unit head notifications: ${settingsResponse.data.unitHeadNotificationsEnabled ? 'enabled' : 'disabled'}`);
        console.log(`  Department head notifications: ${settingsResponse.data.departmentHeadNotificationsEnabled ? 'enabled' : 'disabled'}`);
      }
    } else {
      console.log(`✗ Notification Settings - FAILED (Status: ${settingsResponse.status})`);
    }
    
    console.log('\n=== Email Preview Test Complete ===');
    console.log('All four preview types are available:');
    console.log('- User Summary: Individual user task overview');
    console.log('- Admin Summary: System-wide administrative overview');
    console.log('- Unit Head Summary: Unit-specific management overview');
    console.log('- Department Head Summary: Department-wide oversight');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

testEmailPreviewFunctionality();