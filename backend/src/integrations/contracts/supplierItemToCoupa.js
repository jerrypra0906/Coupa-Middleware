const CoupaClient = require('../../config/coupa');
const SupplierItemStaging = require('../../models/SupplierItemStaging');
const logger = require('../../config/logger');
const pool = require('../../config/database');

/**
 * Supplier Item to Coupa integration.
 *
 * This module handles:
 * - Identifying supplier items that have completed SAP processing.
 * - Updating Coupa Supplier Items with sap-oa-line using PUT API.
 */
async function execute(config) {
  const errors = [];
  let successCount = 0;
  let totalRecords = 0;

  try {
    logger.info('Starting supplier item to Coupa integration...');

    // Debug: Check what supplier items exist for contract_id = 146 or ctr_id = 146
    const debugQuery = `
      SELECT 
        si.contract_id,
        si.csin,
        si.sap_oa_line,
        si.finished_update_coupa_oa,
        si.created_at,
        si.updated_at,
        NOW() as current_time,
        NOW() - INTERVAL '5 minutes' as five_minutes_ago,
        (si.created_at >= NOW() - INTERVAL '5 minutes') as created_within_5min,
        (si.updated_at >= NOW() - INTERVAL '5 minutes') as updated_within_5min,
        chs.finished_update_coupa_oa as header_finished_update_coupa_oa,
        chs.ctr_id
      FROM supplier_item_staging si
      LEFT JOIN contract_header_staging chs ON si.contract_id = chs.contract_id
      WHERE si.contract_id = '146' OR chs.ctr_id = 146
      ORDER BY si.contract_id, si.csin
    `;
    
    try {
      const debugResult = await pool.query(debugQuery);
      logger.info(`Debug - Supplier items for contract_id=146:`, {
        count: debugResult.rows.length,
        items: debugResult.rows.map(row => ({
          contract_id: row.contract_id,
          csin: row.csin,
          sap_oa_line: row.sap_oa_line,
          finished_update_coupa_oa: row.finished_update_coupa_oa,
          created_at: row.created_at,
          updated_at: row.updated_at,
          current_time: row.current_time,
          five_minutes_ago: row.five_minutes_ago,
          created_within_5min: row.created_within_5min,
          updated_within_5min: row.updated_within_5min,
          header_finished_update_coupa_oa: row.header_finished_update_coupa_oa,
          ctr_id: row.ctr_id,
        })),
      });
    } catch (debugError) {
      logger.warn('Debug query failed:', debugError.message);
    }

    // Fetch supplier items ready for Coupa update
    // Criteria: finished_update_sap_oa = TRUE AND finished_update_coupa_oa = FALSE
    const supplierItemsReadyForCoupa = await SupplierItemStaging.findReadyForCoupaUpdate();

    if (!supplierItemsReadyForCoupa || supplierItemsReadyForCoupa.length === 0) {
      logger.info('No supplier items ready for Coupa update');
      
      // Additional debug: Check why items for contract_id=146 or ctr_id=146 are not being selected
      // Remove the finished_update_coupa_oa = FALSE filter to see ALL items
      const whyNotQuery = `
        SELECT 
          si.contract_id,
          si.csin,
          chs.ctr_id,
          si.finished_update_coupa_oa,
          CASE WHEN si.sap_oa_line IS NULL THEN 'sap_oa_line IS NULL' 
               WHEN si.sap_oa_line = '' THEN 'sap_oa_line IS EMPTY'
               ELSE 'OK' END as sap_oa_line_check,
          CASE WHEN si.finished_update_coupa_oa = TRUE THEN 'ALREADY FINISHED - THIS IS WHY NOT SELECTED' ELSE 'OK' END as finished_check,
          CASE WHEN si.csin IS NULL THEN 'CSIN IS NULL' ELSE 'OK' END as csin_check,
          CASE WHEN chs.finished_update_coupa_oa IS NULL THEN 'HEADER NOT FOUND'
               WHEN chs.finished_update_coupa_oa = FALSE THEN 'HEADER NOT FINISHED'
               ELSE 'OK' END as header_check,
          CASE WHEN si.created_at < NOW() - INTERVAL '5 minutes' AND si.updated_at < NOW() - INTERVAL '5 minutes' 
               THEN 'TIMESTAMP TOO OLD (>5min)' ELSE 'OK' END as timestamp_check,
          si.created_at,
          si.updated_at,
          NOW() - INTERVAL '5 minutes' as five_minutes_ago
        FROM supplier_item_staging si
        LEFT JOIN contract_header_staging chs ON si.contract_id = chs.contract_id
        WHERE (si.contract_id = '146' OR chs.ctr_id = 146)
          AND si.sap_oa_line IS NOT NULL
          AND si.sap_oa_line != ''
          AND si.csin IS NOT NULL
      `;
      
      try {
        const whyNotResult = await pool.query(whyNotQuery);
        if (whyNotResult.rows.length > 0) {
          logger.info(`Debug - Why items for contract_id=146 are not selected:`, {
            items: whyNotResult.rows,
          });
        }
      } catch (whyNotError) {
        logger.warn('Why not query failed:', whyNotError.message);
      }
      
      return {
        successCount: 0,
        errorCount: 0,
        totalRecords: 0,
        errors: [],
      };
    }

    logger.info(`Found ${supplierItemsReadyForCoupa.length} supplier items ready for Coupa update`);
    
    // Log which contract_ids are being processed
    const contractIds = [...new Set(supplierItemsReadyForCoupa.map(item => item.contract_id))];
    logger.info(`Processing supplier items for contracts: ${contractIds.join(', ')}`);

    // Update Supplier Items in Coupa using PUT API
    for (const item of supplierItemsReadyForCoupa) {
      const csin = item.csin;
      const sapOaLine = item.sap_oa_line;

      if (!csin || !sapOaLine) {
        logger.warn(`Skipping supplier item with missing CSIN or sap_oa_line: contract_id=${item.contract_id}, csin=${csin}, sap_oa_line=${sapOaLine}`);
        continue;
      }

      try {
        // Build request body
        // Body: { "id": csin, "custom-fields": { "sap-oa-line": sap_oa_line } }
        const requestBody = {
          id: csin,
          'custom-fields': {
            'sap-oa-line': sapOaLine,
          },
        };

        // PUT API call to Coupa
        // URL: https://kpn-test.coupahost.com/api/supplier_items/{csin}
        await CoupaClient.put(
          `/api/supplier_items/${encodeURIComponent(csin)}`,
          requestBody
        );
        
        // Mark as finished updating Coupa
        await SupplierItemStaging.markFinishedCoupaUpdate(item.contract_id, item.csin);
        
        successCount += 1;
        totalRecords += 1;
        logger.info(`Successfully updated Coupa supplier item CSIN=${item.csin} (contract ${item.contract_id})`);
      } catch (error) {
        // Extract only safe, serializable values for raw_payload
        const safeRawPayload = {
          contract_id: item.contract_id,
          csin: csin,
          sap_oa_line: sapOaLine,
        };
        
        // Safely extract response data without circular references
        let safeResponseData = null;
        if (error.response) {
          safeRawPayload.status = error.response.status;
          safeRawPayload.statusText = error.response.statusText;
          // Deep clone response data to avoid circular references
          try {
            if (error.response.data) {
              safeResponseData = typeof error.response.data === 'object' 
                ? JSON.parse(JSON.stringify(error.response.data))
                : error.response.data;
              safeRawPayload.responseData = safeResponseData;
            }
          } catch (e) {
            // If response.data has circular references, just store a string representation
            safeResponseData = String(error.response.data);
            safeRawPayload.responseData = safeResponseData;
          }
        }
        
        // Extract safe error properties for logging (avoid circular references)
        const errorDetails = {
          message: error.message || 'Unknown error',
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: safeResponseData, // Use the safely extracted data
        };
        
        // Log error with safe details (avoid passing error object directly)
        logger.error(
          `Failed to update Coupa supplier_item for CSIN=${csin} (contract ${item.contract_id}): ${errorDetails.message}`,
          errorDetails
        );
        
        errors.push({
          line_number: null,
          field_name: 'COUPA_SUPPLIER_ITEM',
          error_message: `Failed to update supplier item CSIN=${csin}: ${error.message || 'Unknown error'}`,
          raw_payload: safeRawPayload,
        });
      }
    }

    logger.info(
      `Supplier item to Coupa integration completed: ${successCount} successful operations, ${errors.length} errors`
    );

    return {
      successCount,
      errorCount: errors.length,
      totalRecords,
      errors,
    };
  } catch (error) {
    // Extract safe error properties to avoid circular reference issues
    const errorDetails = {
      message: error.message || 'Unknown error',
      code: error.code,
      name: error.name,
      stack: error.stack,
    };
    
    logger.error('Supplier item to Coupa integration failed:', errorDetails);

    if (!errors.some(e => e.field_name === 'SYSTEM')) {
      errors.push({
        line_number: null,
        field_name: 'SYSTEM',
        error_message: error.message || 'Unknown error',
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

