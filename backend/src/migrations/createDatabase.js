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

async function createDatabase() {
  // Try to connect with the configured user first, fallback to 'postgres' user
  const dbName = process.env.DB_NAME || 'coupa_middleware_staging';
  const dbUser = process.env.DB_USERNAME || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';
  
  // First, try with configured credentials
  let adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: 'postgres', // Connect to default postgres database
    user: dbUser,
    password: dbPassword,
    ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
  });

  let poolToUse = null;
  
  // Try with configured credentials first
  try {
    await adminPool.query('SELECT 1');
    poolToUse = adminPool;
    console.log(`Connected successfully with user '${dbUser}'.`);
  } catch (error) {
    // Close the first pool
    await adminPool.end().catch(() => {});
    
    if (error.code === '28P01') { // Authentication failed
      console.log(`Authentication failed for user '${dbUser}'. Trying with 'postgres' user...`);
      
      // Try with postgres user - use POSTGRES_PASSWORD env var, or try empty password
      const postgresPassword = process.env.POSTGRES_PASSWORD || '';
      
      adminPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: 'postgres',
        user: 'postgres',
        password: postgresPassword,
        ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
      });
      
      try {
        await adminPool.query('SELECT 1');
        poolToUse = adminPool;
        console.log('Connected successfully with user "postgres".');
      } catch (err) {
        await adminPool.end().catch(() => {});
        throw new Error(`Cannot connect to PostgreSQL with postgres user. Error: ${err.message}`);
      }
    } else {
      throw error;
    }
  }

  try {
    console.log(`Creating database '${dbName}' if it doesn't exist...`);
    
    // Check if database exists
    const checkResult = await poolToUse.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (checkResult.rows.length > 0) {
      console.log(`Database '${dbName}' already exists.`);
    } else {
      // Create database (note: CREATE DATABASE cannot be run in a transaction)
      await poolToUse.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database '${dbName}' created successfully.`);
    }

    // If we used postgres user and the target user is different, create the user
    if (poolToUse !== adminPool && dbUser !== 'postgres') {
      console.log(`Creating user '${dbUser}' if it doesn't exist...`);
      try {
        // Check if user exists
        const userCheck = await poolToUse.query(
          "SELECT 1 FROM pg_user WHERE usename = $1",
          [dbUser]
        );
        
        if (userCheck.rows.length === 0) {
          await poolToUse.query(`CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}'`);
          console.log(`User '${dbUser}' created successfully.`);
        } else {
          console.log(`User '${dbUser}' already exists. Updating password...`);
          await poolToUse.query(`ALTER USER ${dbUser} WITH PASSWORD '${dbPassword}'`);
        }
        
        // Grant privileges on the new database
        await poolToUse.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser}`);
        console.log(`Granted privileges on '${dbName}' to '${dbUser}'.`);
      } catch (userError) {
        console.warn(`Warning: Could not create/update user '${dbUser}':`, userError.message);
        console.log('You may need to create the user manually or use the postgres user.');
      }
    }

    await poolToUse.end();
    return true;
  } catch (error) {
    console.error('Error creating database:', error.message);
    await poolToUse.end();
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = createDatabase;

