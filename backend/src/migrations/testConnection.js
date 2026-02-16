const { Pool } = require('pg');
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

async function testConnection() {
  console.log('Testing database connection...');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_USERNAME:', process.env.DB_USERNAME);
  console.log('DB_PASSWORD length:', process.env.DB_PASSWORD?.length || 0);
  console.log('DB_PASSWORD (first 3 chars):', process.env.DB_PASSWORD?.substring(0, 3) || 'empty');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'coupa_middleware_staging',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await pool.query('SELECT version(), current_database(), current_user');
    console.log('\n✅ Connection successful!');
    console.log('PostgreSQL version:', result.rows[0].version);
    console.log('Current database:', result.rows[0].current_database);
    console.log('Current user:', result.rows[0].current_user);
    await pool.end();
    return true;
  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    await pool.end();
    throw error;
  }
}

if (require.main === module) {
  testConnection()
    .then(() => {
      console.log('\nConnection test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nConnection test failed');
      process.exit(1);
    });
}

module.exports = testConnection;

