const CoupaClient = require('../../config/coupa');
const SFTPService = require('../../services/sftp/sftpService');
const TransformationService = require('../../services/transformation/transformationService');
const ExchangeRateStaging = require('../../models/ExchangeRateStaging');
const logger = require('../../config/logger');

/**
 * Exchange rate integration: Middleware Staging -> Coupa (CSV or API).
 * Reads exchange rates from staging database and sends to Coupa.
 * Returns an object compatible with IntegrationService expectations.
 */
async function execute(config) {
  const errors = [];
  let successCount = 0;
  let totalRecords = 0;
  let processedRecordIds = [];

  try {
    logger.info('Starting exchange rate integration...');
    
    // 1) Pull from staging database (records with status 'NEW')
    let stagingRecords;
    try {
      stagingRecords = await ExchangeRateStaging.findByStatus('NEW');
      logger.info(`Found ${stagingRecords.length} new exchange rate records in staging`);
      
      if (stagingRecords.length === 0) {
        logger.info('No new exchange rate records to process');
        return {
          successCount: 0,
          errorCount: 0,
          totalRecords: 0,
          errors: [],
        };
      }
    } catch (error) {
      logger.error('Failed to fetch records from staging database:', error);
      errors.push({
        line_number: null,
        field_name: 'DATABASE',
        error_message: `Database query failed: ${error.message}`,
        raw_payload: {
          error: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }

    // 2) Transform staging records to the format needed for Coupa
    const records = stagingRecords.map(record => ({
      id: record.id,
      from_currency: record.from_currency,
      to_currency: record.to_currency,
      rate_value: parseFloat(record.rate_value),
      rate_date: record.rate_date,
    }));

    totalRecords = records.length;
    logger.info(`Processing ${totalRecords} exchange rate records`);

    // 4) Deliver to Coupa (CSV and/or API)
    const deliveryErrors = [];
    let csvSuccess = false;
    let apiSuccess = false;
    
    if (config.integration_mode === 'CSV' || config.integration_mode === 'BOTH') {
      try {
        const csv = TransformationService.buildExchangeRateCSV(records);
        
        // Generate filename using configured naming format
        // config_json can be an object (from DB) or a string (from API)
        let configJson = {};
        if (config.config_json) {
          if (typeof config.config_json === 'string') {
            try {
              configJson = JSON.parse(config.config_json);
            } catch (e) {
              logger.warn('Failed to parse config_json as JSON, using empty object');
            }
          } else {
            configJson = config.config_json;
          }
        }
        
        const namingFormat = configJson.csv_naming_format || 'ExchangeRate_{timestamp}.csv';
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
        const date = now.toISOString().split('T')[0].replace(/-/g, '');
        const datetime = now.toISOString().replace(/[-:T]/g, '').split('.')[0].replace(/(\d{8})(\d{6})/, '$1_$2');
        const moduleName = config.module_name || 'exchange-rate';
        
        let filename = namingFormat
          .replace(/{timestamp}/g, timestamp)
          .replace(/{date}/g, date)
          .replace(/{datetime}/g, datetime)
          .replace(/{module}/g, moduleName);
        
        // Ensure .csv extension
        if (!filename.toLowerCase().endsWith('.csv')) {
          filename += '.csv';
        }
        
        // Get SFTP folder from config or use default
        // The coupa_endpoint for CSV mode should be the SFTP folder path (relative to SFTP_INCOMING_PATH)
        // If it starts with /, it's an absolute path; otherwise it's relative to incomingPath
        let sftpFolder = config.coupa_endpoint 
          ? config.coupa_endpoint.trim()
          : (configJson.sftp_folder || configJson.delivery?.sftp_folder || 'ExchangeRates');
        
        // If folder doesn't start with /, remove leading/trailing slashes for relative path
        if (!sftpFolder.startsWith('/')) {
          sftpFolder = sftpFolder.replace(/^\/+|\/+$/g, '');
        }
        
        logger.info(`Uploading CSV to SFTP folder: ${sftpFolder}`);
        await SFTPService.uploadCSV(csv, filename, sftpFolder);
        logger.info(`Successfully uploaded CSV file: ${filename} to folder: ${sftpFolder}`);
        csvSuccess = true;
        successCount += records.length;
      } catch (error) {
        logger.error('Failed to upload CSV to SFTP:', error);
        deliveryErrors.push({
          line_number: null,
          field_name: 'SFTP_UPLOAD',
          error_message: `SFTP upload failed: ${error.message}`,
          raw_payload: {
            error: error.message,
            code: error.code,
          },
        });
      }
    }

    if (config.integration_mode === 'API' || config.integration_mode === 'BOTH') {
      try {
        const payload = records.map(rec => ({
          from_currency: rec.from_currency,
          to_currency: rec.to_currency,
          rate: rec.rate_value,
          rate_date: rec.rate_date,
        }));
        
        await CoupaClient.postExchangeRates(payload, {
          maxRetries: 3,
          initialDelay: 2000,
          batchSize: 100,
          maxRequestsPerMinute: 100,
        });
        
        logger.info(`Successfully posted ${records.length} records to Coupa API`);
        apiSuccess = true;
        successCount += records.length;
      } catch (error) {
        logger.error('Failed to post to Coupa API:', error);
        
        // Handle batch errors
        if (error.batchErrors) {
          error.batchErrors.forEach((batchError, idx) => {
            const startLine = (batchError.batch - 1) * 100 + 1;
            const endLine = Math.min(batchError.batch * 100, records.length);
            
            deliveryErrors.push({
              line_number: `${startLine}-${endLine}`,
              field_name: 'COUPA_API',
              error_message: `Coupa API batch ${batchError.batch} failed: ${batchError.error}`,
              raw_payload: {
                status: batchError.status,
                responseData: batchError.responseData,
                batchSize: batchError.batchData?.length || 0,
              },
            });
          });
        } else {
          deliveryErrors.push({
            line_number: null,
            field_name: 'COUPA_API',
            error_message: `Coupa API error: ${error.message}`,
            raw_payload: {
              error: error.response?.data || error.message,
              status: error.response?.status,
            },
          });
        }
      }
    }

    // Mark records as processed if at least one delivery method succeeded
    // For BOTH mode, we mark as processed if either CSV or API succeeded
    if (config.integration_mode === 'BOTH') {
      if (csvSuccess || apiSuccess) {
        processedRecordIds = records.map(r => r.id);
      }
    } else if (config.integration_mode === 'CSV' && csvSuccess) {
      processedRecordIds = records.map(r => r.id);
    } else if (config.integration_mode === 'API' && apiSuccess) {
      processedRecordIds = records.map(r => r.id);
    }

    errors.push(...deliveryErrors);

    // Update staging status for successfully delivered records
    if (successCount > 0 && processedRecordIds.length > 0) {
      try {
        for (const recordId of processedRecordIds) {
          await ExchangeRateStaging.updateStatus(recordId, 'PROCESSED');
        }
        logger.info(`Marked ${processedRecordIds.length} records as PROCESSED`);
      } catch (error) {
        logger.warn('Failed to update staging status:', error);
        errors.push({
          line_number: null,
          field_name: 'STATUS_UPDATE',
          error_message: `Failed to update record status: ${error.message}`,
          raw_payload: { error: error.message },
        });
      }
    }

    logger.info(`Exchange rate integration completed: ${successCount} successful, ${errors.length} errors`);

    return {
      successCount,
      errorCount: errors.length,
      totalRecords,
      errors,
    };
  } catch (error) {
    logger.error('Exchange rate integration failed:', error);
    
    // Only add system error if not already added
    if (!errors.some(e => e.field_name === 'SYSTEM')) {
      errors.push({
        line_number: null,
        field_name: 'SYSTEM',
        error_message: error.message,
        raw_payload: {
          stack: error.stack,
          name: error.name,
          code: error.code,
        },
      });
    }

    return {
      successCount,
      errorCount: errors.length,
      totalRecords: totalRecords || errors.length,
      errors,
    };
  }
}

module.exports = { execute };

