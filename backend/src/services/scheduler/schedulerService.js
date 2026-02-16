const cron = require('node-cron');
const IntegrationConfiguration = require('../../models/IntegrationConfiguration');
const IntegrationService = require('../integration/integrationService');
const logger = require('../../config/logger');

// Import integration modules
const exchangeRateIntegration = require('../../integrations/exchange-rate/exchangeRateIntegration');
const suppliersIntegration = require('../../integrations/suppliers/suppliersIntegration');
const purchaseOrdersIntegration = require('../../integrations/purchase-orders/purchaseOrdersIntegration');
const invoicesIntegration = require('../../integrations/invoices/invoicesIntegration');
const contractsHeaderToCoupa = require('../../integrations/contracts/contractsHeaderToCoupa');
const supplierItemToCoupa = require('../../integrations/contracts/supplierItemToCoupa');
const tokenToCoupa = require('../../integrations/contracts/tokenToCoupa');
const contractHeaderIngestion = require('../../integrations/contracts/contractHeaderIngestion');
const supplierItemIngestion = require('../../integrations/contracts/supplierItemIngestion');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing scheduler service...');
      
      // Load all active integrations and schedule them
      const configs = await IntegrationConfiguration.findAll();
      
      for (const config of configs) {
        if (config.is_active) {
          await this.scheduleIntegration(config);
        }
      }
      
      logger.info(`Scheduler service initialized with ${this.jobs.size} active jobs`);
    } catch (error) {
      logger.error('Error initializing scheduler service:', error);
      throw error;
    }
  }

  async scheduleIntegration(config) {
    try {
      // Unschedule if already exists
      if (this.jobs.has(config.module_name)) {
        this.unscheduleIntegration(config.module_name);
      }

      // Parse cron expression from execution_interval
      const cronExpression = this.parseIntervalToCron(config.execution_interval);
      
      if (!cronExpression) {
        logger.warn(`Invalid execution interval for ${config.module_name}: ${config.execution_interval}`);
        return;
      }

      // Get the integration function
      const integrationFunction = this.getIntegrationFunction(config.module_name);
      if (!integrationFunction) {
        logger.warn(`No integration function found for ${config.module_name}`);
        return;
      }

      // Schedule the job
      const job = cron.schedule(cronExpression, async () => {
        logger.info(`Scheduled job triggered for ${config.module_name}`);
        try {
          await IntegrationService.executeIntegration(
            config.module_name,
            integrationFunction
          );
        } catch (error) {
          logger.error(`Error executing scheduled integration ${config.module_name}:`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TZ || 'UTC',
      });

      this.jobs.set(config.module_name, job);
      logger.info(`Scheduled integration ${config.module_name} with interval: ${config.execution_interval}`);
    } catch (error) {
      logger.error(`Error scheduling integration ${config.module_name}:`, error);
      throw error;
    }
  }

  async unscheduleIntegration(moduleName) {
    try {
      const job = this.jobs.get(moduleName);
      if (job) {
        job.stop();
        this.jobs.delete(moduleName);
        logger.info(`Unscheduled integration: ${moduleName}`);
      }
    } catch (error) {
      logger.error(`Error unscheduling integration ${moduleName}:`, error);
      throw error;
    }
  }

  async rescheduleIntegration(moduleName) {
    try {
      const config = await IntegrationConfiguration.findByModule(moduleName);
      if (config && config.is_active) {
        await this.scheduleIntegration(config);
      } else {
        await this.unscheduleIntegration(moduleName);
      }
    } catch (error) {
      logger.error(`Error rescheduling integration ${moduleName}:`, error);
      throw error;
    }
  }

  parseIntervalToCron(interval) {
    // Parse various interval formats to cron expression
    // Examples: "*/5 * * * *", "0 */1 * * *", "every 5 minutes", "every 1 hour"
    
    if (!interval) return null;

    // If it's already a cron expression, return it
    if (cron.validate(interval)) {
      return interval;
    }

    // Parse human-readable formats
    const intervalLower = interval.toLowerCase().trim();
    
    // Every X minutes
    const minutesMatch = intervalLower.match(/every\s+(\d+)\s+minutes?/);
    if (minutesMatch) {
      const minutes = parseInt(minutesMatch[1]);
      return `*/${minutes} * * * *`;
    }

    // Every X hours
    const hoursMatch = intervalLower.match(/every\s+(\d+)\s+hours?/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      return `0 */${hours} * * *`;
    }

    // Every X days
    const daysMatch = intervalLower.match(/every\s+(\d+)\s+days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      return `0 0 */${days} * *`;
    }

    // Daily at specific time (e.g., "daily at 2:00 AM")
    const dailyMatch = intervalLower.match(/daily\s+at\s+(\d+):(\d+)/);
    if (dailyMatch) {
      const hour = parseInt(dailyMatch[1]);
      const minute = parseInt(dailyMatch[2]);
      return `${minute} ${hour} * * *`;
    }

    // Default: try to parse as cron
    return interval;
  }

  getIntegrationFunction(moduleName) {
    const integrationMap = {
      'exchange-rate': exchangeRateIntegration.execute,
      'suppliers': suppliersIntegration.execute,
      'purchase-orders': purchaseOrdersIntegration.execute,
      'invoices': invoicesIntegration.execute,
      'contracts-header-to-coupa': contractsHeaderToCoupa.execute,
      'supplieritem-to-coupa': supplierItemToCoupa.execute,
      'token-to-coupa': tokenToCoupa.execute,
      'contracts-header-ingest': contractHeaderIngestion.execute,
      'contracts-supplieritem-ingest': supplierItemIngestion.execute,
    };

    return integrationMap[moduleName];
  }

  getActiveJobs() {
    const activeJobs = [];
    for (const [moduleName, job] of this.jobs.entries()) {
      activeJobs.push({
        module_name: moduleName,
        is_running: job.running || false,
      });
    }
    return activeJobs;
  }

  async triggerManualRun(moduleName) {
    try {
      const config = await IntegrationConfiguration.findByModule(moduleName);
      if (!config) {
        throw new Error(`Integration ${moduleName} not found`);
      }

      const integrationFunction = this.getIntegrationFunction(moduleName);
      if (!integrationFunction) {
        throw new Error(`No integration function found for ${moduleName}`);
      }

      logger.info(`Manual trigger for ${moduleName}`);
      const result = await IntegrationService.executeIntegration(
        moduleName,
        integrationFunction
      );

      return result;
    } catch (error) {
      logger.error(`Error in manual trigger for ${moduleName}:`, error);
      throw error;
    }
  }
}

module.exports = new SchedulerService();

