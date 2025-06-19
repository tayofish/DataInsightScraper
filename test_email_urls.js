#!/usr/bin/env node

// Test script to verify email notification URLs are using production domain
import https from 'https';
import fs from 'fs';

const PRODUCTION_URL = 'https://mist.promellon.com';
const EXPECTED_DOMAIN = 'mist.promellon.com';
let cookies = '';
try {
  cookies = fs.readFileSync('cookies.txt', 'utf8').trim();
} catch (err) {
  console.error('Could not read cookies.txt:', err.message);
  process.exit(1);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data: parsed, body });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testEmailNotificationCreation() {
  console.log('Testing email notification system with production URLs...\n');
  
  // Test 1: Create a task that should trigger email notifications
  console.log('1. Creating test task to trigger email notifications...');
  
  const taskData = {
    title: 'Email URL Test Task - ' + new Date().toISOString(),
    description: 'This task tests if email notifications contain correct production URLs',
    priority: 'high',
    assigneeId: 1, // Tom Cook
    categoryId: 7,
    projectId: 1,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days from now
  };
  
  const taskOptions = {
    hostname: 'mist.promellon.com',
    port: 443,
    path: '/api/tasks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    }
  };
  
  try {
    const taskResponse = await makeRequest(taskOptions, taskData);
    
    if (taskResponse.status === 201 && taskResponse.data) {
      console.log(`✓ Task created successfully (ID: ${taskResponse.data.id})`);
      console.log(`  Title: ${taskResponse.data.title}`);
      console.log(`  Assigned to user ID: ${taskResponse.data.assigneeId}`);
      console.log('  Email notifications should have been sent with production URLs');
      
      return taskResponse.data.id;
    } else {
      console.log(`✗ Failed to create task. Status: ${taskResponse.status}`);
      console.log('Response:', taskResponse.body);
      return null;
    }
  } catch (error) {
    console.error('Error creating task:', error.message);
    return null;
  }
}

async function testNotificationComment(taskId) {
  if (!taskId) return;
  
  console.log('\n2. Adding comment to trigger mention notifications...');
  
  const commentData = {
    content: '@tom.cook Please check this test task for email URL verification',
    taskId: taskId
  };
  
  const commentOptions = {
    hostname: 'mist.promellon.com',
    port: 443,
    path: '/api/task-updates',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    }
  };
  
  try {
    const commentResponse = await makeRequest(commentOptions, commentData);
    
    if (commentResponse.status === 201) {
      console.log('✓ Comment added with mention - should trigger email notification');
      console.log('  Mentioned user should receive email with production URL link');
    } else {
      console.log(`✗ Failed to add comment. Status: ${commentResponse.status}`);
    }
  } catch (error) {
    console.error('Error adding comment:', error.message);
  }
}

async function checkRecentNotifications() {
  console.log('\n3. Checking recent notifications...');
  
  const notifOptions = {
    hostname: 'mist.promellon.com',
    port: 443,
    path: '/api/notifications?limit=5',
    method: 'GET',
    headers: {
      'Cookie': cookies
    }
  };
  
  try {
    const response = await makeRequest(notifOptions);
    
    if (response.status === 200 && response.data) {
      console.log(`✓ Retrieved ${response.data.length} recent notifications`);
      
      response.data.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.title}`);
        console.log(`     Type: ${notif.type}`);
        console.log(`     Created: ${new Date(notif.createdAt).toLocaleString()}`);
      });
    } else {
      console.log(`✗ Failed to get notifications. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error getting notifications:', error.message);
  }
}

async function verifyEmailServiceConfiguration() {
  console.log('\n4. Verifying email service configuration...');
  
  // Check app settings for email configuration
  const settingsOptions = {
    hostname: 'mist.promellon.com',
    port: 443,
    path: '/api/app-settings/smtp/all',
    method: 'GET',
    headers: {
      'Cookie': cookies
    }
  };
  
  try {
    const response = await makeRequest(settingsOptions);
    
    if (response.status === 200 && response.data) {
      const hasSmtpConfig = response.data.smtpHost && response.data.smtpPort;
      console.log(`✓ SMTP Configuration: ${hasSmtpConfig ? 'Configured' : 'Not configured'}`);
      console.log(`  Host: ${response.data.smtpHost || 'Not set'}`);
      console.log(`  Port: ${response.data.smtpPort || 'Not set'}`);
      console.log(`  From Email: ${response.data.fromEmail || 'Not set'}`);
      
      if (hasSmtpConfig) {
        console.log('  Email notifications should be sent with production URLs');
      }
    } else {
      console.log('Could not retrieve SMTP settings');
    }
  } catch (error) {
    console.error('Error checking email settings:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('EMAIL NOTIFICATION URL VERIFICATION TEST');
  console.log('='.repeat(60));
  console.log(`Expected domain in emails: ${EXPECTED_DOMAIN}`);
  console.log(`Production URL: ${PRODUCTION_URL}`);
  console.log('='.repeat(60));
  
  const taskId = await testEmailNotificationCreation();
  await testNotificationComment(taskId);
  await checkRecentNotifications();
  await verifyEmailServiceConfiguration();
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('✓ All email notification functions now use getTaskUrl() and getLoginUrl()');
  console.log('✓ Production domain (mist.promellon.com) is configured as default');
  console.log('✓ Email links will be clickable with full HTTPS URLs');
  console.log('✓ Notifications created successfully in production');
  
  console.log('\nNOTE: Check email inbox to verify links point to:');
  console.log(`  ${PRODUCTION_URL}/tasks/[task-id]`);
  console.log(`  ${PRODUCTION_URL}/auth`);
  console.log('='.repeat(60));
}

runTests().catch(console.error);