const CoupaClient = require('../../config/coupa');
const SupplierItemStaging = require('../../models/SupplierItemStaging');
const logger = require('../../config/logger');

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

    // Fetch supplier items ready for Coupa update
    // Criteria: finished_update_sap_oa = TRUE AND finished_update_coupa_oa = FALSE
    const supplierItemsReadyForCoupa = await SupplierItemStaging.findReadyForCoupaUpdate();

    if (!supplierItemsReadyForCoupa || supplierItemsReadyForCoupa.length === 0) {
      logger.info('No supplier items ready for Coupa update');
      return {
        successCount: 0,
        errorCount: 0,
        totalRecords: 0,
        errors: [],
      };
    }

    logger.info(`Found ${supplierItemsReadyForCoupa.length} supplier items ready for Coupa update`);

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

