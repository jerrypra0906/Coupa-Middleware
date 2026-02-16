const pool = require('../config/database');
const logger = require('../config/logger');

async function main() {
  try {
    const res = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );
    // eslint-disable-next-line no-console
    console.log('Public tables:');
    for (const row of res.rows) {
      // eslint-disable-next-line no-console
      console.log('-', row.table_name);
    }

    const mig = await pool.query(
      `SELECT version, applied_at
       FROM schema_migrations
       ORDER BY version`
    );
    console.log('\nSchema migrations:');
    for (const row of mig.rows) {
      console.log('-', row.version, row.applied_at);
    }
  } catch (err) {
    logger.error('Error listing tables:', err);
    // eslint-disable-next-line no-console
    console.error('Error listing tables:', err.message);
  } finally {
    await pool.end();
  }
}

main();


