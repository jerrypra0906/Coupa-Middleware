const pool = require('../config/database');
const logger = require('../config/logger');

class ExchangeRateStaging {
  static async create(data) {
    const { from_currency, to_currency, rate_value, rate_date, status = 'NEW' } = data;
    const query = `
      INSERT INTO exchange_rate_staging 
      (from_currency, to_currency, rate_value, rate_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (from_currency, to_currency, rate_date)
      DO UPDATE SET 
        rate_value = EXCLUDED.rate_value,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [from_currency, to_currency, rate_value, rate_date, status]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating exchange rate staging record:', error);
      throw error;
    }
  }

  static async findByStatus(status) {
    const query = 'SELECT * FROM exchange_rate_staging WHERE status = $1 ORDER BY created_at DESC';
    try {
      const result = await pool.query(query, [status]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding exchange rate staging records:', error);
      throw error;
    }
  }

  static async updateStatus(id, status) {
    const query = 'UPDATE exchange_rate_staging SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    try {
      const result = await pool.query(query, [status, id]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating exchange rate staging status:', error);
      throw error;
    }
  }

  static async bulkCreate(records) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const record of records) {
        const { from_currency, to_currency, rate_value, rate_date, status = 'NEW' } = record;
        const query = `
          INSERT INTO exchange_rate_staging 
          (from_currency, to_currency, rate_value, rate_date, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (from_currency, to_currency, rate_date)
          DO UPDATE SET 
            rate_value = EXCLUDED.rate_value,
            status = EXCLUDED.status,
            updated_at = NOW()
          RETURNING *
        `;
        const result = await client.query(query, [from_currency, to_currency, rate_value, rate_date, status]);
        results.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error bulk creating exchange rate staging records:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = ExchangeRateStaging;

