const IntegrationLog = require('../../models/IntegrationLog');
const IntegrationConfiguration = require('../../models/IntegrationConfiguration');
const ErrorService = require('../error/errorService');
const EmailService = require('../email/emailService');
const logger = require('../../config/logger');

class IntegrationService {
  async executeIntegration(integrationName, integrationFunction) {
    const startTime = Date.now();
    let integrationLog = null;
    let config = null;
    
    try {
      logger.info(`Starting integration: ${integrationName}`);
      
      // Get integration configuration
      config = await IntegrationConfiguration.findByModule(integrationName);
      if (!config || !config.is_active) {
        throw new Error(`Integration ${integrationName} is not active or not configured`);
      }

      // Create integration log entry
      integrationLog = await IntegrationLog.create({
        integration_name: integrationName,
        status: 'RUNNING',
        success_count: 0,
        error_count: 0,
        total_records: 0,
        duration_ms: 0,
        started_at: new Date(),
        completed_at: null,
      });

      // Execute the integration function
      const result = await integrationFunction(config);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Determine status
      let status = 'SUCCESS';
      if (result.errors && result.errors.length > 0) {
        status = result.successCount > 0 ? 'PARTIAL' : 'FAILED';
      }

      // Log errors if any
      if (result.errors && result.errors.length > 0) {
        await ErrorService.logBulkErrors(integrationLog.id, result.errors);
      }

      // Update the existing integration log entry
      integrationLog = await IntegrationLog.update(integrationLog.id, {
        status: status,
        success_count: result.successCount || 0,
        error_count: result.errorCount || 0,
        total_records: result.totalRecords || 0,
        duration_ms: duration,
        completed_at: new Date(),
      });

      // Send email notification based on scheduler configuration
      if (config && config.email_notification_enabled) {
        const shouldSendEmail = 
          (status === 'SUCCESS' && config.email_on_success) ||
          (status === 'FAILED' && config.email_on_failure) ||
          (status === 'PARTIAL' && config.email_on_partial);
        
        if (shouldSendEmail) {
          try {
            if (status === 'SUCCESS') {
              await EmailService.sendSuccessNotification(integrationLog);
            } else {
              const errorDetails = result.errors || [];
              await EmailService.sendErrorNotification(integrationLog, errorDetails);
            }
          } catch (emailError) {
            logger.error('Error sending email notification:', emailError);
            // Don't throw - email failure shouldn't fail the integration
          }
        }
      }

      logger.info(`Integration ${integrationName} completed with status: ${status}`);
      return {
        success: true,
        log: integrationLog,
        result: result,
      };
    } catch (error) {
      logger.error(`Integration ${integrationName} failed:`, error);
      
      const duration = Date.now() - startTime;
      
      // Update log with failure status
      if (integrationLog) {
        integrationLog = await IntegrationLog.update(integrationLog.id, {
          status: 'FAILED',
          success_count: 0,
          error_count: 0,
          total_records: 0,
          duration_ms: duration,
          completed_at: new Date(),
        });

        // Log the error
        await ErrorService.logError(integrationLog.id, {
          line_number: null,
          field_name: 'SYSTEM',
          error_message: error.message,
          raw_payload: { stack: error.stack },
        });

        // Send email notification if enabled and configured for failures
        // Get config if not already available
        if (!config) {
          try {
            config = await IntegrationConfiguration.findByModule(integrationName);
          } catch (err) {
            logger.warn('Could not fetch config for email notification:', err);
          }
        }
        
        if (config && config.email_notification_enabled && config.email_on_failure) {
          try {
            await EmailService.sendErrorNotification(integrationLog, [{
              line_number: null,
              field_name: 'SYSTEM',
              error_message: error.message,
            }]);
          } catch (emailError) {
            logger.error('Error sending email notification:', emailError);
          }
        }
      }

      return {
        success: false,
        log: integrationLog,
        error: error.message,
      };
    }
  }

  async getIntegrationStatus(integrationName) {
    try {
      const config = await IntegrationConfiguration.findByModule(integrationName);
      const recentLogs = await IntegrationLog.findByIntegration(integrationName, 10, 0);
      const stats = await IntegrationLog.getStats(integrationName, 7);

      return {
        configuration: config,
        recentLogs: recentLogs,
        stats: stats[0] || null,
      };
    } catch (error) {
      logger.error(`Error getting integration status for ${integrationName}:`, error);
      throw error;
    }
  }

  async getAllIntegrationsStatus() {
    try {
      const configs = await IntegrationConfiguration.findAll();
      const statuses = [];

      for (const config of configs) {
        const status = await this.getIntegrationStatus(config.module_name);
        statuses.push(status);
      }

      return statuses;
    } catch (error) {
      logger.error('Error getting all integrations status:', error);
      throw error;
    }
  }
}

module.exports = new IntegrationService();

