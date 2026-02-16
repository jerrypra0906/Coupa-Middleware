// Test SFTP connection
const sftpConfig = require('./src/config/sftp');
const logger = require('./src/config/logger');

async function testSFTP() {
  console.log('Testing SFTP connection...');
  console.log('SFTP Configuration:');
  console.log({
    host: process.env.SFTP_HOST,
    port: process.env.SFTP_PORT,
    username: process.env.SFTP_USERNAME,
    incomingPath: process.env.SFTP_INCOMING_PATH,
    passwordSet: !!process.env.SFTP_PASSWORD
  });
  console.log('');

  try {
    // Test connection
    console.log('1. Testing SFTP connection...');
    const sftp = await sftpConfig.connect();
    console.log('✓ SFTP connection successful!');
    console.log('');

    // Test listing files in incoming path
    console.log('2. Testing list files in incoming path...');
    try {
      const incomingPath = process.env.SFTP_INCOMING_PATH || '/Incoming';
      const files = await sftpConfig.listFiles(incomingPath);
      console.log(`✓ Successfully listed files in ${incomingPath}`);
      console.log(`  Found ${files.length} items`);
      if (files.length > 0) {
        console.log('  Sample items:');
        files.slice(0, 5).forEach(file => {
          console.log(`    - ${file.name} (${file.type === 'd' ? 'directory' : 'file'})`);
        });
      }
    } catch (error) {
      console.log(`✗ Failed to list files: ${error.message}`);
    }
    console.log('');

    // Test listing a specific folder if provided
    const testFolder = process.argv[2] || 'FxRates';
    console.log(`3. Testing access to folder: ${testFolder}...`);
    try {
      const folderPath = `${process.env.SFTP_INCOMING_PATH || '/Incoming'}/${testFolder}`;
      const folderFiles = await sftpConfig.listFiles(folderPath);
      console.log(`✓ Successfully accessed folder: ${folderPath}`);
      console.log(`  Found ${folderFiles.length} items`);
      if (folderFiles.length > 0) {
        console.log('  Sample items:');
        folderFiles.slice(0, 5).forEach(file => {
          console.log(`    - ${file.name} (${file.type === 'd' ? 'directory' : 'file'})`);
        });
      }
    } catch (error) {
      console.log(`✗ Failed to access folder ${testFolder}: ${error.message}`);
      console.log('  (This might be normal if the folder does not exist yet)');
    }
    console.log('');

    console.log('✓ All SFTP tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ SFTP test failed:');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    if (error.stack) {
      console.error('  Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Load environment variables
const path = require('path');
const fs = require('fs');
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
} else {
  require('dotenv').config();
  console.log('Loaded default .env file');
}
console.log('');

testSFTP();

