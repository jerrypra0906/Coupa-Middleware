const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const logger = require('../config/logger');

async function seedDefaultAdmin(client = null) {
  let shouldRelease = false;
  let shouldCommit = false;
  
  // If no client provided, get one from pool (for standalone execution)
  if (!client) {
    client = await pool.connect();
    shouldRelease = true;
    shouldCommit = true;
    await client.query('BEGIN');
  }
  
  try {
    // Check if admin user already exists
    const checkResult = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (checkResult.rows.length > 0) {
      logger.info('Admin user already exists, skipping seed');
      if (shouldCommit) {
        await client.query('COMMIT');
      }
      return;
    }

    // Default admin credentials
    const username = 'admin';
    const email = 'admin@coupa-middleware.local';
    const password = 'admin123'; // Change this in production!
    const role = 'ADMIN';

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert admin user
    const insertQuery = `
      INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, username, email, role
    `;

    const result = await client.query(insertQuery, [
      username,
      email,
      password_hash,
      role,
      true
    ]);

    if (shouldCommit) {
      await client.query('COMMIT');
    }
    
    logger.info('Default admin user created successfully');
    logger.info(`Username: ${username}`);
    logger.info(`Password: ${password} (CHANGE THIS IN PRODUCTION!)`);
    logger.warn('⚠️  IMPORTANT: Change the default admin password after first login!');
    
    return result.rows[0];
  } catch (error) {
    if (shouldCommit) {
      await client.query('ROLLBACK');
    }
    logger.error('Error seeding default admin:', error);
    throw error;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedDefaultAdmin()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = seedDefaultAdmin;

