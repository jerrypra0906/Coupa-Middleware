const express = require('express');
const IntegrationLog = require('../../models/IntegrationLog');
const ErrorService = require('../../services/error/errorService');
const { authenticate } = require('../../middleware/authMiddleware');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Summary stats for dashboard cards and charts
 */
router.get('/stats', authenticate, async (_req, res) => {
  try {
    const [logStats, errorStats] = await Promise.all([
      IntegrationLog.getStats(null, 7),
      ErrorService.getErrorStats(null, 7)
    ]);

    // Aggregate overall stats
    const totals = logStats.reduce(
      (acc, item) => {
        acc.totalRuns += parseInt(item.total_runs || 0, 10);
        acc.successRuns += parseInt(item.success_count || 0, 10);
        acc.failedRuns += parseInt(item.failed_count || 0, 10);
        acc.partialRuns += parseInt(item.partial_count || 0, 10);
        acc.totalSuccessRecords += parseInt(item.total_success_records || 0, 10);
        acc.totalErrorRecords += parseInt(item.total_error_records || 0, 10);
        return acc;
      },
      {
        totalRuns: 0,
        successRuns: 0,
        failedRuns: 0,
        partialRuns: 0,
        totalSuccessRecords: 0,
        totalErrorRecords: 0
      }
    );

    res.json({
      stats: {
        runs: totals,
        perIntegration: logStats,
        errors: errorStats
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;

