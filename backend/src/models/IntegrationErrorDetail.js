const pool = require('../config/database');
const logger = require('../config/logger');

class IntegrationErrorDetail {
  static async create(data) {
    const {
      integration_log_id,
      line_number,
      field_name,
      error_message,
      raw_payload,
      retry_status = 'PENDING'
    } = data;
    
    const query = `
      INSERT INTO integration_error_detail 
      (integration_log_id, line_number, field_name, error_message, raw_payload, retry_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        integration_log_id,
        line_number,
        field_name,
        error_message,
        JSON.stringify(raw_payload),
        retry_status
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating integration error detail:', error);
      throw error;
    }
  }

  static async findByLogId(logId) {
    const query = 'SELECT * FROM integration_error_detail WHERE integration_log_id = $1 ORDER BY line_number';
    try {
      const result = await pool.query(query, [logId]);
      return result.rows.map(row => ({
        ...row,
        raw_payload: typeof row.raw_payload === 'string' ? JSON.parse(row.raw_payload) : row.raw_payload
      }));
    } catch (error) {
      logger.error('Error finding integration error details:', error);
      throw error;
    }
  }

  static async updateRetryStatus(id, retryStatus) {
    const query = 'UPDATE integration_error_detail SET retry_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    try {
      const result = await pool.query(query, [retryStatus, id]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating error detail retry status:', error);
      throw error;
    }
  }

  static async bulkCreate(errors) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      
      for (const error of errors) {
        const {
          integration_log_id,
          line_number,
          field_name,
          error_message,
          raw_payload,
          retry_status = 'PENDING'
        } = error;
        
        const query = `
          INSERT INTO integration_error_detail 
          (integration_log_id, line_number, field_name, error_message, raw_payload, retry_status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          RETURNING *
        `;
        const result = await client.query(query, [
          integration_log_id,
          line_number,
          field_name,
          error_message,
          JSON.stringify(raw_payload),
          retry_status
        ]);
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error bulk creating error details:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = IntegrationErrorDetail;

