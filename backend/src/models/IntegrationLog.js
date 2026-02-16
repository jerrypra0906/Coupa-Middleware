const pool = require('../config/database');
const logger = require('../config/logger');

class IntegrationLog {
  static async create(data) {
    const {
      integration_name,
      status,
      success_count = 0,
      error_count = 0,
      total_records = 0,
      duration_ms = 0,
      started_at,
      completed_at
    } = data;
    
    const query = `
      INSERT INTO integration_log 
      (integration_name, status, success_count, error_count, total_records, duration_ms, started_at, completed_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        integration_name,
        status,
        success_count,
        error_count,
        total_records,
        duration_ms,
        started_at || new Date(),
        completed_at || new Date()
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating integration log:', error);
      throw error;
    }
  }

  static async findById(id) {
    const query = 'SELECT * FROM integration_log WHERE id = $1';
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error finding integration log:', error);
      throw error;
    }
  }

  static async findByIntegration(integrationName, limit = 100, offset = 0) {
    const query = `
      SELECT * FROM integration_log 
      WHERE integration_name = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    try {
      const result = await pool.query(query, [integrationName, limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding integration logs:', error);
      throw error;
    }
  }

  static async findByDateRange(startDate, endDate, integrationName = null) {
    let query = `
      SELECT * FROM integration_log 
      WHERE created_at BETWEEN $1 AND $2
    `;
    const params = [startDate, endDate];
    
    if (integrationName) {
      query += ' AND integration_name = $3';
      params.push(integrationName);
    }
    
    query += ' ORDER BY created_at DESC';
    
    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error finding integration logs by date range:', error);
      throw error;
    }
  }

  static async getStats(integrationName = null, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let query = `
      SELECT 
        integration_name,
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'PARTIAL' THEN 1 ELSE 0 END) as partial_count,
        AVG(duration_ms) as avg_duration_ms,
        SUM(success_count) as total_success_records,
        SUM(error_count) as total_error_records
      FROM integration_log
      WHERE created_at >= $1
    `;
    
    const params = [startDate];
    
    if (integrationName) {
      query += ' AND integration_name = $2';
      params.push(integrationName);
    }
    
    query += ' GROUP BY integration_name';
    
    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting integration stats:', error);
      throw error;
    }
  }

  static async findLastByIntegration(integrationName) {
    const query = `
      SELECT *
      FROM integration_log
      WHERE integration_name = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    try {
      const result = await pool.query(query, [integrationName]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error finding last integration log:', error);
      throw error;
    }
  }

  static async update(id, data) {
    const {
      status,
      success_count,
      error_count,
      total_records,
      duration_ms,
      completed_at
    } = data;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (success_count !== undefined) {
      updates.push(`success_count = $${paramIndex++}`);
      values.push(success_count);
    }
    if (error_count !== undefined) {
      updates.push(`error_count = $${paramIndex++}`);
      values.push(error_count);
    }
    if (total_records !== undefined) {
      updates.push(`total_records = $${paramIndex++}`);
      values.push(total_records);
    }
    if (duration_ms !== undefined) {
      updates.push(`duration_ms = $${paramIndex++}`);
      values.push(duration_ms);
    }
    if (completed_at !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(completed_at);
    }
    
    if (updates.length === 0) {
      return await this.findById(id);
    }
    
    values.push(id);
    const query = `
      UPDATE integration_log 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating integration log:', error);
      throw error;
    }
  }
}

module.exports = IntegrationLog;

