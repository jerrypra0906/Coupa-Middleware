// Detailed SFTP connection test
const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
} else {
  require('dotenv').config();
  console.log('Loaded default .env file');
}

console.log('\n=== SFTP Configuration ===');
console.log('Host:', process.env.SFTP_HOST);
console.log('Port:', process.env.SFTP_PORT);
console.log('Username:', process.env.SFTP_USERNAME);
console.log('Password:', process.env.SFTP_PASSWORD ? `${process.env.SFTP_PASSWORD.substring(0, 3)}***` : 'NOT SET');
console.log('Password Length:', process.env.SFTP_PASSWORD?.length || 0);
console.log('Incoming Path:', process.env.SFTP_INCOMING_PATH);
console.log('');

async function testConnection() {
  const sftp = new SftpClient();
  
  const config = {
    host: process.env.SFTP_HOST,
    port: parseInt(process.env.SFTP_PORT) || 22,
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
    readyTimeout: 30000,
    // Try different authentication methods
    tryKeyboard: true,
    debug: (info) => {
      // Only log important debug messages
      if (info.includes('error') || info.includes('auth') || info.includes('handshake')) {
        console.log('DEBUG:', info);
      }
    }
  };

  console.log('=== Attempting Connection ===');
  console.log('Config:', {
    host: config.host,
    port: config.port,
    username: config.username,
    passwordSet: !!config.password,
    passwordLength: config.password?.length || 0
  });
  console.log('');

  try {
    console.log('Connecting to SFTP server...');
    await sftp.connect(config);
    console.log('✓ Connection successful!');
    console.log('');

    // Test listing root directory
    console.log('Testing directory listing...');
    try {
      const files = await sftp.list('/');
      console.log(`✓ Successfully listed root directory (${files.length} items)`);
      if (files.length > 0) {
        console.log('Sample items:');
        files.slice(0, 5).forEach(file => {
          console.log(`  - ${file.name} (${file.type === 'd' ? 'dir' : 'file'})`);
        });
      }
    } catch (error) {
      console.log(`✗ Failed to list root: ${error.message}`);
    }
    console.log('');

    // Test incoming path
    const incomingPath = process.env.SFTP_INCOMING_PATH || '/Incoming';
    console.log(`Testing access to: ${incomingPath}`);
    try {
      const files = await sftp.list(incomingPath);
      console.log(`✓ Successfully accessed ${incomingPath} (${files.length} items)`);
      if (files.length > 0) {
        console.log('Sample items:');
        files.slice(0, 5).forEach(file => {
          console.log(`  - ${file.name} (${file.type === 'd' ? 'dir' : 'file'})`);
        });
      }
    } catch (error) {
      console.log(`✗ Failed to access ${incomingPath}: ${error.message}`);
    }
    console.log('');

    await sftp.end();
    console.log('✓ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Connection failed!');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    if (error.message.includes('authentication')) {
      console.error('\nPossible issues:');
      console.error('1. Username or password is incorrect');
      console.error('2. Server requires key-based authentication');
      console.error('3. Account is locked or disabled');
      console.error('4. IP address is not whitelisted');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('\nPossible issues:');
      console.error('1. Hostname is incorrect');
      console.error('2. Port is incorrect');
      console.error('3. Firewall is blocking the connection');
      console.error('4. Server is down');
    }
    
    process.exit(1);
  }
}

testConnection();

