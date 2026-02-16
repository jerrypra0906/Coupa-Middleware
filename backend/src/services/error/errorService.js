const IntegrationErrorDetail = require('../../models/IntegrationErrorDetail');
const IntegrationLog = require('../../models/IntegrationLog');
const logger = require('../../config/logger');

class ErrorService {
  async logError(integrationLogId, errorData) {
    try {
      const errorDetail = await IntegrationErrorDetail.create({
        integration_log_id: integrationLogId,
        line_number: errorData.line_number,
        field_name: errorData.field_name,
        error_message: errorData.error_message,
        raw_payload: errorData.raw_payload,
        retry_status: 'PENDING',
      });
      return errorDetail;
    } catch (error) {
      logger.error('Error logging error detail:', error);
      throw error;
    }
  }

  async logBulkErrors(integrationLogId, errors) {
    try {
      const errorDetails = errors.map(error => ({
        integration_log_id: integrationLogId,
        line_number: error.line_number,
        field_name: error.field_name,
        error_message: error.error_message,
        raw_payload: error.raw_payload,
        retry_status: 'PENDING',
      }));

      const results = await IntegrationErrorDetail.bulkCreate(errorDetails);
      return results;
    } catch (error) {
      logger.error('Error bulk logging errors:', error);
      throw error;
    }
  }

  async getErrorsByLogId(logId) {
    try {
      const errors = await IntegrationErrorDetail.findByLogId(logId);
      return errors;
    } catch (error) {
      logger.error('Error getting errors by log ID:', error);
      throw error;
    }
  }

  async updateRetryStatus(errorId, retryStatus) {
    try {
      const error = await IntegrationErrorDetail.updateRetryStatus(errorId, retryStatus);
      return error;
    } catch (error) {
      logger.error('Error updating retry status:', error);
      throw error;
    }
  }

  async categorizeError(error) {
    // Categorize errors for better reporting
    const errorMessage = error.error_message?.toLowerCase() || '';
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return 'AUTH_ERROR';
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('missing')) {
      return 'VALIDATION_ERROR';
    }
    if (errorMessage.includes('mapping') || errorMessage.includes('transformation')) {
      return 'MAPPING_ERROR';
    }
    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return 'DATABASE_ERROR';
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return 'RATE_LIMIT_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  async getErrorStats(integrationName = null, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const logs = await IntegrationLog.findByDateRange(startDate, new Date(), integrationName);
      const errorDetails = [];
      
      for (const log of logs) {
        const errors = await IntegrationErrorDetail.findByLogId(log.id);
        errorDetails.push(...errors);
      }

      const categorized = {};
      errorDetails.forEach(error => {
        const category = this.categorizeError(error);
        if (!categorized[category]) {
          categorized[category] = 0;
        }
        categorized[category]++;
      });

      return {
        totalErrors: errorDetails.length,
        byCategory: categorized,
        topErrors: errorDetails
          .reduce((acc, error) => {
            const key = error.error_message?.substring(0, 100) || 'Unknown';
            if (!acc[key]) {
              acc[key] = { message: error.error_message, count: 0 };
            }
            acc[key].count++;
            return acc;
          }, {}),
      };
    } catch (error) {
      logger.error('Error getting error stats:', error);
      throw error;
    }
  }

  async retryError(errorId) {
    try {
      const error = await IntegrationErrorDetail.updateRetryStatus(errorId, 'RETRYING');
      return error;
    } catch (error) {
      logger.error('Error retrying error:', error);
      throw error;
    }
  }

  async markErrorResolved(errorId) {
    try {
      const error = await IntegrationErrorDetail.updateRetryStatus(errorId, 'RESOLVED');
      return error;
    } catch (error) {
      logger.error('Error marking error as resolved:', error);
      throw error;
    }
  }
}

module.exports = new ErrorService();

