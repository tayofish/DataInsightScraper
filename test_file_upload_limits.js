// Test script to verify file upload limits are working correctly
const fs = require('fs');
const path = require('path');

// Create test files of different sizes
function createTestFile(sizeInMB, filename) {
  const size = sizeInMB * 1024 * 1024; // Convert MB to bytes
  const buffer = Buffer.alloc(size, 'A'); // Fill with 'A' characters
  
  fs.writeFileSync(filename, buffer);
  console.log(`Created test file: ${filename} (${sizeInMB}MB)`);
}

// Test file upload endpoints
async function testFileUpload(endpoint, filePath, additionalData = {}) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('file', fs.createReadStream(filePath));
    
    // Add any additional form data
    Object.keys(additionalData).forEach(key => {
      form.append(key, additionalData[key]);
    });
    
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        // Add basic auth or session cookies if needed
        'Cookie': 'connect.sid=your-session-id'
      }
    });
    
    const result = await response.text();
    console.log(`${endpoint}: ${response.status} - ${result.substring(0, 100)}...`);
    
    return response.status;
  } catch (error) {
    console.error(`Error testing ${endpoint}:`, error.message);
    return 500;
  }
}

async function runTests() {
  console.log('Creating test files...');
  
  // Create test files of different sizes
  createTestFile(0.5, 'test_500kb.txt');     // Should work
  createTestFile(2, 'test_2mb.txt');         // Should work
  createTestFile(5, 'test_5mb.txt');         // Should work
  createTestFile(8, 'test_8mb.txt');         // Should work
  createTestFile(12, 'test_12mb.txt');       // Should fail (over 10MB limit)
  
  console.log('\nTesting file upload endpoints...');
  
  // Test task file upload
  await testFileUpload('/api/tasks/1/files', 'test_2mb.txt');
  
  // Test direct message file upload
  await testFileUpload('/api/direct-messages/upload', 'test_2mb.txt', {
    receiverId: '2',
    content: 'File test'
  });
  
  // Test logo upload
  await testFileUpload('/api/app-settings/logo', 'test_500kb.txt');
  
  // Test large file (should fail)
  console.log('\nTesting oversized file (should fail):');
  await testFileUpload('/api/tasks/1/files', 'test_12mb.txt');
  
  // Cleanup test files
  console.log('\nCleaning up test files...');
  ['test_500kb.txt', 'test_2mb.txt', 'test_5mb.txt', 'test_8mb.txt', 'test_12mb.txt'].forEach(file => {
    try {
      fs.unlinkSync(file);
      console.log(`Deleted: ${file}`);
    } catch (error) {
      console.log(`Could not delete ${file}: ${error.message}`);
    }
  });
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testFileUpload, createTestFile };