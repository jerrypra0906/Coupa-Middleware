const express = require('express');
const { query, validationResult } = require('express-validator');
const IntegrationLog = require('../../models/IntegrationLog');
const IntegrationErrorDetail = require('../../models/IntegrationErrorDetail');
const pool = require('../../config/database');
const { authenticate } = require('../../middleware/authMiddleware');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * GET /api/logs
 * Get integration logs with filtering and pagination
 * Query params: integration_name, status, start_date, end_date, page, limit
 */
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['SUCCESS', 'FAILED', 'PARTIAL']).withMessage('Invalid status'),
  query('integration_name').optional().isString().trim(),
  query('start_date').optional().isISO8601().withMessage('Invalid start date format'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { integration_name, status, start_date, end_date } = req.query;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (integration_name) {
      whereConditions.push(`integration_name = $${paramIndex}`);
      queryParams.push(integration_name);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM integration_log ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    queryParams.push(limit, offset);
    const dataQuery = `
      SELECT * FROM integration_log 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataResult = await pool.query(dataQuery, queryParams);
    
    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching integration logs:', error);
    res.status(500).json({ error: 'Failed to fetch integration logs' });
  }
});

/**
 * GET /api/logs/:id
 * Get a specific integration log with error details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const logId = parseInt(req.params.id);
    
    if (isNaN(logId)) {
      return res.status(400).json({ error: 'Invalid log ID' });
    }
    
    // Get log
    const log = await IntegrationLog.findById(logId);
    
    if (!log) {
      return res.status(404).json({ error: 'Integration log not found' });
    }

    // Get error details if any
    const errors = await IntegrationErrorDetail.findByLogId(logId);

    res.json({
      log,
      errors,
      errorCount: errors.length
    });
  } catch (error) {
    logger.error('Error fetching integration log details:', error);
    res.status(500).json({ error: 'Failed to fetch integration log details' });
  }
});

/**
 * GET /api/logs/integrations/list
 * Get list of unique integration names
 */
router.get('/integrations/list', authenticate, async (req, res) => {
  try {
    const queryText = 'SELECT DISTINCT integration_name FROM integration_log ORDER BY integration_name';
    const result = await pool.query(queryText);
    
    res.json({
      integrations: result.rows.map(row => row.integration_name)
    });
  } catch (error) {
    logger.error('Error fetching integration list:', error);
    res.status(500).json({ error: 'Failed to fetch integration list' });
  }
});

module.exports = router;
