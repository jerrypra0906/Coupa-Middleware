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

const pool = require('../config/database');
const logger = require('../config/logger');

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get migration files (both .sql and .js)
    const migrationsDir = __dirname;
    const sqlFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    const jsFiles = fs.readdirSync(migrationsDir)
      .filter(file =>
        file.endsWith('.js') &&
        ![
          'runMigrations.js',
          'createDatabase.js',
          'testConnection.js',
          'testLogin.js',
          'verifyAdmin.js',
          'insert_sample_exchange_rate.js',
        ].includes(file)
      )
      .sort();
    
    logger.info(`Found ${sqlFiles.length} SQL migration files and ${jsFiles.length} JS migration files`);
    
    // Process SQL migrations
    for (const file of sqlFiles) {
      const version = path.basename(file, '.sql');
      
      // Check if migration already applied
      const checkResult = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      
      if (checkResult.rows.length > 0) {
        logger.info(`Migration ${version} already applied, skipping`);
        continue;
      }
      
      // Read and execute migration
      const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      logger.info(`Applying migration ${version}...`);
      
      await client.query(migrationSQL);
      
      // Record migration
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      
      logger.info(`Migration ${version} applied successfully`);
    }
    
    // Process JS migrations
    for (const file of jsFiles) {
      const version = path.basename(file, '.js');
      
      // Check if migration already applied
      const checkResult = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      
      if (checkResult.rows.length > 0) {
        logger.info(`Migration ${version} already applied, skipping`);
        continue;
      }
      
      logger.info(`Applying JS migration ${version}...`);
      
      // Import and run the migration function
      // Pass the client so migrations can use the same transaction
      const migrationModule = require(path.join(migrationsDir, file));
      if (typeof migrationModule === 'function') {
        await migrationModule(client);
      } else if (migrationModule && typeof migrationModule.default === 'function') {
        await migrationModule.default(client);
      } else {
        throw new Error(`Migration ${version} does not export a function`);
      }
      
      // Record migration
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      
      logger.info(`Migration ${version} applied successfully`);
    }
    
    await client.query('COMMIT');
    logger.info('All migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = runMigrations;

