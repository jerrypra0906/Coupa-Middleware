const pool = require('../config/database');
const logger = require('../config/logger');

class IntegrationConfiguration {
  static async findByModule(moduleName) {
    const query = 'SELECT * FROM integration_configuration WHERE module_name = $1';
    try {
      const result = await pool.query(query, [moduleName]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error finding integration configuration:', error);
      throw error;
    }
  }

  static async findAll() {
    const query = 'SELECT * FROM integration_configuration ORDER BY module_name';
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error finding all integration configurations:', error);
      throw error;
    }
  }

  static async createOrUpdate(data) {
    const {
      module_name,
      execution_interval,
      integration_mode,
      is_active,
      sap_endpoint,
      coupa_endpoint,
      retry_mode,
      config_json,
      email_notification_enabled,
      email_on_success,
      email_on_failure,
      email_on_partial
    } = data;
    
    const query = `
      INSERT INTO integration_configuration 
      (module_name, execution_interval, integration_mode, is_active, sap_endpoint, coupa_endpoint, retry_mode, config_json, 
       email_notification_enabled, email_on_success, email_on_failure, email_on_partial, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT (module_name) 
      DO UPDATE SET 
        execution_interval = EXCLUDED.execution_interval,
        integration_mode = EXCLUDED.integration_mode,
        is_active = EXCLUDED.is_active,
        sap_endpoint = EXCLUDED.sap_endpoint,
        coupa_endpoint = EXCLUDED.coupa_endpoint,
        retry_mode = EXCLUDED.retry_mode,
        config_json = EXCLUDED.config_json,
        email_notification_enabled = EXCLUDED.email_notification_enabled,
        email_on_success = EXCLUDED.email_on_success,
        email_on_failure = EXCLUDED.email_on_failure,
        email_on_partial = EXCLUDED.email_on_partial,
        updated_at = NOW()
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        module_name,
        execution_interval,
        integration_mode,
        is_active,
        sap_endpoint,
        coupa_endpoint,
        retry_mode,
        JSON.stringify(config_json || {}),
        email_notification_enabled ?? false,
        email_on_success ?? false,
        email_on_failure ?? true,
        email_on_partial ?? true
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating/updating integration configuration:', error);
      throw error;
    }
  }

  static async updateActiveStatus(moduleName, isActive) {
    const query = 'UPDATE integration_configuration SET is_active = $1, updated_at = NOW() WHERE module_name = $2 RETURNING *';
    try {
      const result = await pool.query(query, [isActive, moduleName]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating integration configuration active status:', error);
      throw error;
    }
  }
}

module.exports = IntegrationConfiguration;

