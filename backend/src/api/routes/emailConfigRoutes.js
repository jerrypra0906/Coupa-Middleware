const express = require('express');
const { body, param, validationResult } = require('express-validator');
const NotificationRecipients = require('../../models/NotificationRecipients');
const { authenticate, authorize } = require('../../middleware/authMiddleware');
const logger = require('../../config/logger');

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
};

/**
 * GET /api/email-config/recipients
 */
router.get('/recipients', authenticate, async (_req, res) => {
  try {
    const recipients = await NotificationRecipients.findAll();
    res.json({ data: recipients });
  } catch (error) {
    logger.error('Error fetching recipients:', error);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

/**
 * POST /api/email-config/recipients
 */
router.post(
  '/recipients',
  authenticate,
  authorize('ADMIN'),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('group_name').notEmpty().withMessage('Group name is required'),
    body('notification_type')
      .isIn(['CRITICAL', 'CRITICAL_PARTIAL', 'ALL'])
      .withMessage('Invalid notification type'),
    body('is_active').optional().isBoolean()
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const recipient = await NotificationRecipients.create({
        email: req.body.email,
        group_name: req.body.group_name,
        notification_type: req.body.notification_type,
        is_active: req.body.is_active !== undefined ? req.body.is_active : true
      });
      res.status(201).json({ message: 'Recipient created', recipient });
    } catch (error) {
      logger.error('Error creating recipient:', error);
      res.status(500).json({ error: 'Failed to create recipient' });
    }
  }
);

/**
 * PUT /api/email-config/recipients/:id
 */
router.put(
  '/recipients/:id',
  authenticate,
  authorize('ADMIN'),
  [
    param('id').isInt().withMessage('Invalid recipient ID'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('group_name').notEmpty().withMessage('Group name is required'),
    body('notification_type')
      .isIn(['CRITICAL', 'CRITICAL_PARTIAL', 'ALL'])
      .withMessage('Invalid notification type'),
    body('is_active').isBoolean().withMessage('is_active must be boolean')
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const updated = await NotificationRecipients.update(req.params.id, {
        email: req.body.email,
        group_name: req.body.group_name,
        notification_type: req.body.notification_type,
        is_active: req.body.is_active
      });

      if (!updated) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      res.json({ message: 'Recipient updated', recipient: updated });
    } catch (error) {
      logger.error('Error updating recipient:', error);
      res.status(500).json({ error: 'Failed to update recipient' });
    }
  }
);

/**
 * DELETE /api/email-config/recipients/:id
 */
router.delete(
  '/recipients/:id',
  authenticate,
  authorize('ADMIN'),
  [param('id').isInt().withMessage('Invalid recipient ID')],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const deleted = await NotificationRecipients.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Recipient not found' });
      }
      res.json({ message: 'Recipient deleted' });
    } catch (error) {
      logger.error('Error deleting recipient:', error);
      res.status(500).json({ error: 'Failed to delete recipient' });
    }
  }
);

module.exports = router;

