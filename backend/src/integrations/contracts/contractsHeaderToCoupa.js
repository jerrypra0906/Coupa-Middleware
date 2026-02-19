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
    
    // Debug: Log all headers to see what data we have
    logger.info(`Debug - Contract headers data:`, {
      headers: contractHeadersReadyForCoupa.map(h => ({
        contract_id: h.contract_id,
        ctr_id: h.ctr_id,
        ctr_id_type: typeof h.ctr_id,
        ctr_num: h.ctr_num,
        sap_oa_number: h.sap_oa_number,
      })),
    });

    // Update Contract Headers in Coupa using PUT API
    for (const header of contractHeadersReadyForCoupa) {
      // Use ctr_id (Coupa Contract ID) for the API call, not contract_id (Contract Number)
      let coupaContractId = header.ctr_id;  // This is the actual Coupa Contract ID (INTEGER)
      const contractId = header.contract_id;  // This is the Contract Number (VARCHAR) - used for database operations
      const contractNumber = header.ctr_num || header.contract_number;  // Contract Number from CSV
      const sapOaNumber = header.sap_oa_number;

      // If ctr_id is missing, try to GET the contract from Coupa to find its actual ID
      if (!coupaContractId && contractNumber) {
        logger.warn(
          `ctr_id is missing for contract_id=${contractId}, contract_number=${contractNumber}. Attempting to find contract in Coupa...`
        );
        try {
          // Try to GET contract by contract number - Coupa API might support this
          // If not, we'll need to search or use a different approach
          const searchResult = await CoupaClient.get(`/api/contracts?contract_number=${encodeURIComponent(contractNumber)}`);
          if (searchResult && searchResult.length > 0 && searchResult[0].id) {
            coupaContractId = searchResult[0].id;
            logger.info(`Found Coupa Contract ID ${coupaContractId} for contract_number=${contractNumber}`);
          }
        } catch (error) {
          logger.warn(`Could not retrieve contract from Coupa for contract_number=${contractNumber}:`, error.message);
        }
      }

      if (!coupaContractId || !sapOaNumber) {
        logger.warn(
          `Skipping contract header with missing ctr_id (Coupa Contract ID) or sap_oa_number (ctr_id=${coupaContractId}, contract_id=${contractId}, contract_number=${contractNumber}, sap_oa_number=${sapOaNumber})`
        );
        continue;
      }

      try {
        // Build request body to match exact format from example:
        // { "id": number, "custom-fields": { "sap-oa": string }, "status": "published" }
        // ctr_id comes from database as INTEGER, but ensure it's a number
        let contractIdNum;
        if (typeof coupaContractId === 'number') {
          contractIdNum = coupaContractId;
        } else if (typeof coupaContractId === 'string') {
          contractIdNum = Number(coupaContractId);
          // Validate the conversion worked
          if (isNaN(contractIdNum) || !isFinite(contractIdNum)) {
            throw new Error(`Invalid Coupa Contract ID (ctr_id): ${coupaContractId} (cannot convert to number)`);
          }
        } else {
          throw new Error(`Invalid Coupa Contract ID (ctr_id) type: ${typeof coupaContractId}`);
        }
        
        // Double-check it's a number
        if (typeof contractIdNum !== 'number' || isNaN(contractIdNum)) {
          throw new Error(`Coupa Contract ID conversion failed: ${coupaContractId} -> ${contractIdNum}`);
        }
        
        // Create request body - ensure id is explicitly a number
        // Create a new object to avoid any reference issues
        const requestBody = {
          id: contractIdNum,  // Explicitly a number - this is the Coupa Contract ID
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
            coupaContractId,
            coupaContractIdType: typeof coupaContractId,
            contractIdNum,
            contractIdNumType: typeof contractIdNum,
            requestBody,
            requestBodyJson,
            parsedCheck,
          });
          throw new Error(`Request body id is being serialized as ${typeof parsedCheck.id} instead of number`);
        }
        
        logger.info(`Updating Coupa contract header:`, {
          ctr_id: coupaContractId,
          ctr_idType: typeof coupaContractId,
          contract_id: contractId,
          contract_idType: typeof contractId,
          contractIdNum,
          contractIdNumType: typeof contractIdNum,
          requestBodyId: requestBody.id,
          requestBodyIdType: typeof requestBody.id,
          requestBodyJson: requestBodyJson,
          parsedId: parsedCheck.id,
          parsedIdType: typeof parsedCheck.id,
          endpoint: `/api/contracts/${contractIdNum}`,
          fullHeader: header, // Debug: show all header fields
        });

        // PUT API call to Coupa
        // URL: https://kpn-test.coupahost.com/api/contracts/{ctr_id}
        // Use ctr_id (Coupa Contract ID) in the URL, not contract_id (Contract Number)
        await CoupaClient.put(
          `/api/contracts/${encodeURIComponent(contractIdNum)}`,
          requestBody
        );

        // Mark as finished updating Coupa - use contract_id (Contract Number) for database operations
        await ContractHeaderStaging.markFinishedCoupaUpdate(contractId);

        successCount += 1;
        totalRecords += 1;
        logger.info(`Successfully updated Coupa contract header (ctr_id=${coupaContractId}, contract_id=${contractId}) with SAP OA=${sapOaNumber}`);
      } catch (error) {
        // Extract only safe, serializable values for raw_payload
        const safeRawPayload = {
          ctr_id: coupaContractId,  // Coupa Contract ID used in API call
          contract_id: contractId,   // Contract Number (database key)
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
          `Failed to update Coupa contract header (ctr_id=${coupaContractId}, contract_id=${contractId}): ${errorDetails.message}`,
          errorDetails
        );
        
        errors.push({
          line_number: null,
          field_name: 'COUPA_CONTRACT_HEADER',
          error_message: `Failed to update contract header (ctr_id=${coupaContractId}, contract_id=${contractId}): ${error.message || 'Unknown error'}`,
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

