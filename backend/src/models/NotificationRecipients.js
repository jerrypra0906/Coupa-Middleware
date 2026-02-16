const pool = require('../config/database');
const logger = require('../config/logger');

class NotificationRecipients {
  static async findAll() {
    const query = 'SELECT * FROM notification_recipients WHERE is_active = true ORDER BY group_name, email';
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error finding notification recipients:', error);
      throw error;
    }
  }

  static async findByGroup(groupName) {
    const query = 'SELECT * FROM notification_recipients WHERE group_name = $1 AND is_active = true';
    try {
      const result = await pool.query(query, [groupName]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding notification recipients by group:', error);
      throw error;
    }
  }

  static async create(data) {
    const { email, group_name, notification_type, is_active = true } = data;
    const query = `
      INSERT INTO notification_recipients (email, group_name, notification_type, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [email, group_name, notification_type, is_active]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating notification recipient:', error);
      throw error;
    }
  }

  static async update(id, data) {
    const { email, group_name, notification_type, is_active } = data;
    const query = `
      UPDATE notification_recipients 
      SET email = $1, group_name = $2, notification_type = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    try {
      const result = await pool.query(query, [email, group_name, notification_type, is_active, id]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating notification recipient:', error);
      throw error;
    }
  }

  static async delete(id) {
    const query = 'DELETE FROM notification_recipients WHERE id = $1 RETURNING *';
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error deleting notification recipient:', error);
      throw error;
    }
  }
}

module.exports = NotificationRecipients;

