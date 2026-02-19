const CoupaClient = require('../../config/coupa');
const ContractHeaderStaging = require('../../models/ContractHeaderStaging');
const logger = require('../../config/logger');

/**
 * Contract Header to Coupa integration.
 *
 * This module handles:
 * - Identifying contract headers that have completed SAP processing.
 * - Updating Coupa Contract Headers with sap-oa and publishing status using PUT API.
 */
async function execute(config) {
  const errors = [];
  let successCount = 0;
  let totalRecords = 0;

  try {
    logger.info('Starting contract header to Coupa integration...');

    // Fetch contract headers ready for Coupa update
    // Criteria: contract_id IS NOT NULL AND sap_oa_number IS NOT NULL AND finished_update_coupa_oa = FALSE
    const contractHeadersReadyForCoupa = await ContractHeaderStaging.findReadyForCoupaUpdate();

    if (!contractHeadersReadyForCoupa || contractHeadersReadyForCoupa.length === 0) {
      logger.info('No contract headers ready for Coupa update');
      return {
        successCount: 0,
        errorCount: 0,
        totalRecords: 0,
        errors: [],
      };
    }

    logger.info(`Found ${contractHeadersReadyForCoupa.length} contract headers ready for Coupa update`);

    // Update Contract Headers in Coupa using PUT API
    for (const header of contractHeadersReadyForCoupa) {
      const contractId = header.contract_id;
      const sapOaNumber = header.sap_oa_number;

      if (!contractId || !sapOaNumber) {
        logger.warn(
          `Skipping contract header with missing contractId or sap_oa_number (contractId=${contractId}, sap_oa_number=${sapOaNumber})`
        );
        continue;
      }

      try {
        // Build request body to match exact format from example:
        // { "id": number, "custom-fields": { "sap-oa": string }, "status": "published" }
        // Contract ID comes from database as VARCHAR, so it's a string - convert to number
        // Use Number() for more reliable conversion, then validate it's actually a number
        let contractIdNum;
        if (typeof contractId === 'number') {
          contractIdNum = contractId;
        } else if (typeof contractId === 'string') {
          contractIdNum = Number(contractId);
          // Validate the conversion worked
          if (isNaN(contractIdNum) || !isFinite(contractIdNum)) {
            throw new Error(`Invalid contract ID: ${contractId} (cannot convert to number)`);
          }
        } else {
          throw new Error(`Invalid contract ID type: ${typeof contractId}`);
        }
        
        // Double-check it's a number
        if (typeof contractIdNum !== 'number' || isNaN(contractIdNum)) {
          throw new Error(`Contract ID conversion failed: ${contractId} -> ${contractIdNum}`);
        }
        
        // Create request body - ensure id is explicitly a number
        // Create a new object to avoid any reference issues
        const requestBody = {
          id: contractIdNum,  // Explicitly a number
          'custom-fields': {
            'sap-oa': String(sapOaNumber),
          },
          status: 'published',
        };

        // Verify id is a number before sending
        if (typeof requestBody.id !== 'number' || isNaN(requestBody.id)) {
          throw new Error(`Contract ID must be a number, got: ${typeof requestBody.id} (${requestBody.id})`);
        }

        // Verify JSON serialization maintains number type
        const requestBodyJson = JSON.stringify(requestBody);
        const parsedCheck = JSON.parse(requestBodyJson);
        
        // Verify parsed id is a number (not string)
        if (typeof parsedCheck.id !== 'number') {
          logger.error(`ERROR: Request body id is being serialized as ${typeof parsedCheck.id}!`, {
            contractId,
            contractIdType: typeof contractId,
            contractIdNum,
            contractIdNumType: typeof contractIdNum,
            requestBody,
            requestBodyJson,
            parsedCheck,
          });
          throw new Error(`Request body id is being serialized as ${typeof parsedCheck.id} instead of number`);
        }
        
        logger.info(`Updating Coupa contract header:`, {
          contractId,
          contractIdType: typeof contractId,
          contractIdNum,
          contractIdNumType: typeof contractIdNum,
          requestBodyId: requestBody.id,
          requestBodyIdType: typeof requestBody.id,
          requestBodyJson: requestBodyJson,
          parsedId: parsedCheck.id,
          parsedIdType: typeof parsedCheck.id,
          endpoint: `/api/contracts/${contractId}`,
        });

        // PUT API call to Coupa
        // URL: https://kpn-test.coupahost.com/api/contracts/{contract_id}
        await CoupaClient.put(
          `/api/contracts/${encodeURIComponent(contractId)}`,
          requestBody
        );

        // Mark as finished updating Coupa
        await ContractHeaderStaging.markFinishedCoupaUpdate(contractId);

        successCount += 1;
        totalRecords += 1;
        logger.info(`Successfully updated Coupa contract header Contract ID=${contractId} with SAP OA=${sapOaNumber}`);
      } catch (error) {
        // Extract only safe, serializable values for raw_payload
        const safeRawPayload = {
          contract_id: contractId,
          sap_oa_number: sapOaNumber,
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
          `Failed to update Coupa contract header for Contract ID=${contractId}: ${errorDetails.message}`,
          errorDetails
        );
        
        errors.push({
          line_number: null,
          field_name: 'COUPA_CONTRACT_HEADER',
          error_message: `Failed to update contract header ID=${contractId}: ${error.message || 'Unknown error'}`,
          raw_payload: safeRawPayload,
        });
      }
    }

    logger.info(
      `Contract header to Coupa integration completed: ${successCount} successful operations, ${errors.length} errors`
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
    
    logger.error('Contract header to Coupa integration failed:', errorDetails);

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

