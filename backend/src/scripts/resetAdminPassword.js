const User = require('../models/User');
const pool = require('../config/database');
const logger = require('../config/logger');

async function resetAdminPassword() {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT id, username FROM users WHERE username = $1', ['admin']);
      let userId;

      if (res.rows.length === 0) {
        logger.info('Admin user not found, creating a new one...');
        const newUser = await User.create({
          username: 'admin',
          email: 'admin@coupa-middleware.local',
          password: 'admin123',
          role: 'ADMIN',
        });
        userId = newUser.id;
      } else {
        userId = res.rows[0].id;
        logger.info(`Found existing admin user with id=${userId}, resetting password...`);
        await User.updatePassword(userId, 'admin123');
      }

      logger.info('Admin credentials are now:');
      logger.info('  username: admin');
      logger.info('  password: admin123  (PLEASE CHANGE AFTER FIRST LOGIN)');
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Failed to reset admin password:', err);
    // eslint-disable-next-line no-console
    console.error('Failed to reset admin password:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  resetAdminPassword().then(() => {
    process.exit(0);
  });
}


