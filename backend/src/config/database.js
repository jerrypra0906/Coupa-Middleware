const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load .env.staging if NODE_ENV is staging, otherwise load .env
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);

if (fs.existsSync(envPath)) {
  const result = require('dotenv').config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  }
} else {
  require('dotenv').config();
}

// Debug: Log database config (without password)
console.log('Database config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  passwordSet: !!process.env.DB_PASSWORD,
  passwordType: typeof process.env.DB_PASSWORD
});

// Ensure password is always a string
const dbPassword = process.env.DB_PASSWORD;
const passwordString = (dbPassword != null && dbPassword !== undefined) ? String(dbPassword) : '';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'coupa_middleware',
  user: process.env.DB_USERNAME || 'postgres',
  password: passwordString,
  ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Set timezone to Asia/Jakarta (GMT+7) for all database connections
pool.on('connect', async (client) => {
  console.log('Database connected successfully');
  // Set timezone to Asia/Jakarta (GMT+7) for this connection
  try {
    await client.query("SET timezone = 'Asia/Jakarta'");
  } catch (err) {
    console.error('Error setting timezone:', err);
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;

