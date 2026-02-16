const pool = require('../config/database');
const logger = require('../config/logger');
const bcrypt = require('bcryptjs');

class User {
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    try {
      const result = await pool.query(query, [username]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    try {
      const result = await pool.query(query, [email]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    const query = 'SELECT id, username, email, role, is_active, last_login, created_at, updated_at FROM users WHERE id = $1';
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error finding user by id:', error);
      throw error;
    }
  }

  static async create(data) {
    const { username, email, password, role = 'VIEWER' } = data;
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const query = `
      INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, username, email, role, is_active, created_at, updated_at
    `;
    
    try {
      const result = await pool.query(query, [username, email, password_hash, role, true]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  static async updateLastLogin(userId) {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
    try {
      await pool.query(query, [userId]);
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw error;
    }
  }

  static async updatePassword(userId, newPassword) {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);
    
    const query = 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2';
    try {
      await pool.query(query, [password_hash, userId]);
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  static async updateRole(userId, role) {
    const query = 'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, email, role, is_active';
    try {
      const result = await pool.query(query, [role, userId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  static async toggleActive(userId) {
    const query = 'UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, username, email, role, is_active';
    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error toggling user active status:', error);
      throw error;
    }
  }

  static async getAll(limit = 100, offset = 0) {
    const query = `
      SELECT id, username, email, role, is_active, last_login, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    try {
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }
}

module.exports = User;

