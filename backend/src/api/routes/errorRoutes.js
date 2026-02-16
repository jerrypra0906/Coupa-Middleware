const express = require('express');
const { query, body, validationResult } = require('express-validator');
const pool = require('../../config/database');
const IntegrationErrorDetail = require('../../models/IntegrationErrorDetail');
const IntegrationLog = require('../../models/IntegrationLog');
const { authenticate, authorize } = require('../../middleware/authMiddleware');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * GET /api/errors
 * Get error details with filtering and pagination
 * Query params: integration_name, retry_status, log_id, page, limit
 */
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('retry_status').optional().isIn(['PENDING', 'RETRYING', 'RETRIED', 'IGNORED']).withMessage('Invalid retry status'),
  query('integration_name').optional().isString().trim(),
  query('log_id').optional().isInt().withMessage('Invalid log ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const { integration_name, retry_status, log_id } = req.query;

    // Build query with joins to get integration name
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (log_id) {
      whereConditions.push(`ed.integration_log_id = $${paramIndex}`);
      queryParams.push(log_id);
      paramIndex++;
    }

    if (retry_status) {
      whereConditions.push(`ed.retry_status = $${paramIndex}`);
      queryParams.push(retry_status);
      paramIndex++;
    }

    if (integration_name) {
      whereConditions.push(`il.integration_name = $${paramIndex}`);
      queryParams.push(integration_name);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM integration_error_detail ed
      LEFT JOIN integration_log il ON ed.integration_log_id = il.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    queryParams.push(limit, offset);
    const dataQuery = `
      SELECT 
        ed.*,
        il.integration_name,
        il.status as log_status,
        il.created_at as log_created_at
      FROM integration_error_detail ed
      LEFT JOIN integration_log il ON ed.integration_log_id = il.id
      ${whereClause}
      ORDER BY ed.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataResult = await pool.query(dataQuery, queryParams);
    
    // Parse raw_payload JSON
    const errorList = dataResult.rows.map(row => ({
      ...row,
      raw_payload: typeof row.raw_payload === 'string' 
        ? JSON.parse(row.raw_payload) 
        : row.raw_payload
    }));
    
    res.json({
      data: errorList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching error details:', error);
    res.status(500).json({ error: 'Failed to fetch error details' });
  }
});

/**
 * GET /api/errors/:id
 * Get a specific error detail
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const errorId = parseInt(req.params.id);
    
    if (isNaN(errorId)) {
      return res.status(400).json({ error: 'Invalid error ID' });
    }

    const query = `
      SELECT 
        ed.*,
        il.integration_name,
        il.status as log_status,
        il.created_at as log_created_at
      FROM integration_error_detail ed
      LEFT JOIN integration_log il ON ed.integration_log_id = il.id
      WHERE ed.id = $1
    `;
    const result = await pool.query(query, [errorId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error detail not found' });
    }

    const error = result.rows[0];
    error.raw_payload = typeof error.raw_payload === 'string' 
      ? JSON.parse(error.raw_payload) 
      : error.raw_payload;

    res.json({ error });
  } catch (error) {
    logger.error('Error fetching error detail:', error);
    res.status(500).json({ error: 'Failed to fetch error detail' });
  }
});

/**
 * POST /api/errors/:id/retry
 * Retry a specific error (Admin or Integration Operator only)
 */
router.post('/:id/retry', authenticate, authorize('ADMIN', 'INTEGRATION_OPERATOR'), async (req, res) => {
  try {
    const errorId = parseInt(req.params.id);
    
    if (isNaN(errorId)) {
      return res.status(400).json({ error: 'Invalid error ID' });
    }

    // Get error detail
    const errorQuery = 'SELECT * FROM integration_error_detail WHERE id = $1';
    const errorResult = await pool.query(errorQuery, [errorId]);
    
    if (errorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Error detail not found' });
    }

    const errorDetail = errorResult.rows[0];

    // Update retry status to RETRYING
    const updated = await IntegrationErrorDetail.updateRetryStatus(errorId, 'RETRYING');

    // TODO: Add to retry queue or trigger retry process
    // For now, we just update the status
    logger.info(`Error ${errorId} marked for retry by user ${req.user.username}`);

    res.json({
      message: 'Error marked for retry',
      error: updated
    });
  } catch (error) {
    logger.error('Error retrying error:', error);
    res.status(500).json({ error: 'Failed to retry error' });
  }
});

/**
 * PUT /api/errors/:id
 * Update error detail (manual correction) - Admin only
 */
router.put('/:id', authenticate, authorize('ADMIN'), [
  body('error_message').optional().isString().trim(),
  body('retry_status').optional().isIn(['PENDING', 'RETRYING', 'RETRIED', 'IGNORED']),
  body('raw_payload').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const errorId = parseInt(req.params.id);
    
    if (isNaN(errorId)) {
      return res.status(400).json({ error: 'Invalid error ID' });
    }

    const { error_message, retry_status, raw_payload } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (error_message !== undefined) {
      updates.push(`error_message = $${paramIndex}`);
      values.push(error_message);
      paramIndex++;
    }

    if (retry_status !== undefined) {
      updates.push(`retry_status = $${paramIndex}`);
      values.push(retry_status);
      paramIndex++;
    }

    if (raw_payload !== undefined) {
      updates.push(`raw_payload = $${paramIndex}`);
      values.push(JSON.stringify(raw_payload));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(errorId);

    const updateQuery = `
      UPDATE integration_error_detail 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error detail not found' });
    }

    const updated = result.rows[0];
    updated.raw_payload = typeof updated.raw_payload === 'string' 
      ? JSON.parse(updated.raw_payload) 
      : updated.raw_payload;

    logger.info(`Error ${errorId} updated by user ${req.user.username}`);

    res.json({
      message: 'Error detail updated successfully',
      error: updated
    });
  } catch (error) {
    logger.error('Error updating error detail:', error);
    res.status(500).json({ error: 'Failed to update error detail' });
  }
});

/**
 * POST /api/errors/bulk-retry
 * Retry multiple errors at once (Admin or Integration Operator only)
 */
router.post('/bulk-retry', authenticate, authorize('ADMIN', 'INTEGRATION_OPERATOR'), [
  body('error_ids').isArray().withMessage('error_ids must be an array'),
  body('error_ids.*').isInt().withMessage('Each error ID must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { error_ids } = req.body;
    const results = [];

    for (const errorId of error_ids) {
      try {
        const updated = await IntegrationErrorDetail.updateRetryStatus(errorId, 'RETRYING');
        results.push({ id: errorId, status: 'success', error: updated });
      } catch (error) {
        results.push({ id: errorId, status: 'failed', error: error.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    logger.info(`Bulk retry: ${successCount}/${error_ids.length} errors marked for retry by user ${req.user.username}`);

    res.json({
      message: `Marked ${successCount} errors for retry`,
      results
    });
  } catch (error) {
    logger.error('Error bulk retrying errors:', error);
    res.status(500).json({ error: 'Failed to bulk retry errors' });
  }
});

module.exports = router;

