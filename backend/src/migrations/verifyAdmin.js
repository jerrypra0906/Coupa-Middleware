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

async function verifyAdmin() {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, is_active, created_at FROM users WHERE username = $1',
      ['admin']
    );
    
    if (result.rows.length > 0) {
      console.log('\n✅ Admin user found:');
      console.log(JSON.stringify(result.rows[0], null, 2));
      console.log('\n📝 Default credentials:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    } else {
      console.log('\n❌ Admin user not found');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

verifyAdmin();

