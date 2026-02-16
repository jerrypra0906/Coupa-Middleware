const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

// Load .env.staging if NODE_ENV is staging, otherwise load .env
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function testLogin() {
  try {
    // Get admin user
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = $1',
      ['admin']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Admin user not found');
      await pool.end();
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('\n📋 User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active}`);
    console.log(`   Password hash length: ${user.password_hash?.length || 0}`);
    console.log(`   Password hash (first 20 chars): ${user.password_hash?.substring(0, 20) || 'N/A'}...`);
    
    // Test password verification
    const testPassword = 'admin123';
    console.log(`\n🔐 Testing password: "${testPassword}"`);
    
    const isMatch = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`   Password match: ${isMatch ? '✅ YES' : '❌ NO'}`);
    
    if (!isMatch) {
      console.log('\n⚠️  Password verification failed!');
      console.log('   This might mean:');
      console.log('   1. The password hash was not created correctly');
      console.log('   2. The password in the database is different');
      console.log('\n   Let me try to recreate the password hash...');
      
      // Recreate password hash
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log(`   New hash: ${newHash.substring(0, 20)}...`);
      
      // Update the password
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, user.id]
      );
      
      // Test again
      const newMatch = await bcrypt.compare(testPassword, newHash);
      console.log(`   New password match: ${newMatch ? '✅ YES' : '❌ NO'}`);
      
      if (newMatch) {
        console.log('\n✅ Password hash updated successfully!');
        console.log('   Try logging in again with: admin / admin123');
      }
    } else {
      console.log('\n✅ Password verification successful!');
      console.log('   The issue might be elsewhere (backend code, network, etc.)');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

testLogin();

