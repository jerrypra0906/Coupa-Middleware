const express = require('express');
const { body, param, validationResult } = require('express-validator');
const IntegrationConfiguration = require('../../models/IntegrationConfiguration');
const IntegrationLog = require('../../models/IntegrationLog');
const { authenticate, authorize } = require('../../middleware/authMiddleware');
const logger = require('../../config/logger');
const cronParser = require('cron-parser');
const cron = require('node-cron');
const schedulerService = require('../../services/scheduler/schedulerService');

const router = express.Router();

// Helper to handle validation results
const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
};

/**
 * GET /api/schedulers
 * List all integration configurations (scheduler settings) with last run status
 */
router.get('/', authenticate, async (_req, res) => {
  try {
    const configs = await IntegrationConfiguration.findAll();

    // Enrich with last run info from integration logs
    const enriched = await Promise.all(
      configs.map(async (cfg) => {
        const lastLog = await IntegrationLog.findLastByIntegration(cfg.module_name);
        let nextRunAt = null;
        try {
          if (cfg.execution_interval) {
            const interval = cronParser.parseExpression(cfg.execution_interval);
            nextRunAt = interval.next().toDate();
          }
        } catch (err) {
          logger.warn(`Invalid cron for ${cfg.module_name}: ${cfg.execution_interval}`);
        }
        return {
          ...cfg,
          last_status: lastLog?.status || null,
          last_run_at: lastLog?.created_at || null,
          last_error_count: lastLog?.error_count || 0,
          last_success_count: lastLog?.success_count || 0,
          next_run_at: nextRunAt,
        };
      })
    );

    res.json({ data: enriched });
  } catch (error) {
    logger.error('Error fetching scheduler configs:', error);
    res.status(500).json({ error: 'Failed to fetch scheduler configurations' });
  }
});

/**
 * PUT /api/schedulers/:moduleName
 * Update scheduler configuration for a module
 */
router.put(
  '/:moduleName',
  authenticate,
  authorize('ADMIN'),
  [
    param('moduleName').notEmpty().withMessage('Module name is required'),
    body('execution_interval')
      .notEmpty().withMessage('Execution interval is required')
      .custom((value) => {
        // Accept both cron expressions and human-readable formats
        // Try cron validation first
        if (cron.validate(value)) {
          return true;
        }
        // Try parsing as cron expression
        try {
          cronParser.parseExpression(value);
          return true;
        } catch (err) {
          // If not a cron expression, try to convert from human-readable format
          const converted = schedulerService.parseIntervalToCron(value);
          if (converted && cron.validate(converted)) {
            return true;
          }
          throw new Error('Invalid cron expression or interval format');
        }
      }),
    body('integration_mode')
      .isIn(['API', 'CSV', 'BOTH'])
      .withMessage('integration_mode must be API, CSV, or BOTH'),
    body('retry_mode')
      .optional()
      .isIn(['AUTOMATIC', 'MANUAL'])
      .withMessage('retry_mode must be AUTOMATIC or MANUAL'),
    body('is_active').isBoolean().withMessage('is_active must be boolean'),
    body('sap_endpoint').optional({ nullable: true, checkFalsy: true }).isString().withMessage('sap_endpoint must be a string'),
    body('coupa_endpoint').optional({ nullable: true, checkFalsy: true }).isString().withMessage('coupa_endpoint must be a string'),
    body('config_json').optional().isObject(),
    body('email_notification_enabled').optional().isBoolean(),
    body('email_on_success').optional().isBoolean(),
    body('email_on_failure').optional().isBoolean(),
    body('email_on_partial').optional().isBoolean()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const moduleName = req.params.moduleName;
      
      // Convert human-readable interval to cron if needed
      let executionInterval = req.body.execution_interval;
      if (!cron.validate(executionInterval)) {
        // Try to convert from human-readable format
        const converted = schedulerService.parseIntervalToCron(executionInterval);
        if (converted && cron.validate(converted)) {
          executionInterval = converted;
        }
      }
      
      const payload = {
        module_name: moduleName,
        execution_interval: executionInterval,
        integration_mode: req.body.integration_mode,
        is_active: req.body.is_active,
        sap_endpoint: req.body.sap_endpoint,
        coupa_endpoint: req.body.coupa_endpoint,
        retry_mode: req.body.retry_mode || 'MANUAL',
        config_json: req.body.config_json || {},
        email_notification_enabled: req.body.email_notification_enabled ?? false,
        email_on_success: req.body.email_on_success ?? false,
        email_on_failure: req.body.email_on_failure ?? true,
        email_on_partial: req.body.email_on_partial ?? true
      };

      const updated = await IntegrationConfiguration.createOrUpdate(payload);
      
      // Reschedule the integration if it's active
      if (updated.is_active) {
        await schedulerService.rescheduleIntegration(moduleName);
      } else {
        await schedulerService.unscheduleIntegration(moduleName);
      }
      res.json({ message: 'Scheduler configuration updated', config: updated });
    } catch (error) {
      logger.error('Error updating scheduler config:', error);
      res.status(500).json({ error: 'Failed to update scheduler configuration' });
    }
  }
);

/**
 * POST /api/schedulers/:moduleName/trigger
 * Manually trigger an integration run
 */
router.post(
  '/:moduleName/trigger',
  authenticate,
  authorize('ADMIN', 'INTEGRATION_OPERATOR'),
  [param('moduleName').notEmpty().withMessage('Module name is required')],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const moduleName = req.params.moduleName;
      
      // Check if integration exists and is configured
      const config = await IntegrationConfiguration.findByModule(moduleName);
      if (!config) {
        return res.status(404).json({ error: `Integration ${moduleName} not found` });
      }

      // Trigger the integration asynchronously (don't wait for completion)
      schedulerService.triggerManualRun(moduleName)
        .then((result) => {
          logger.info(`Manual trigger completed for ${moduleName}:`, {
            success: result.success,
            logId: result.log?.id
          });
        })
        .catch((error) => {
          logger.error(`Manual trigger failed for ${moduleName}:`, error);
        });

      // Return immediately with queued status
      res.json({
        message: `Manual trigger queued for module ${moduleName}`,
        status: 'QUEUED',
        module_name: moduleName
      });
    } catch (error) {
      logger.error('Error triggering scheduler:', error);
      res.status(500).json({ error: 'Failed to trigger integration', details: error.message });
    }
  }
);

module.exports = router;

