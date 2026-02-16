const CoupaClient = require('../../config/coupa');
const ContractHeaderStaging = require('../../models/ContractHeaderStaging');
const SupplierItemStaging = require('../../models/SupplierItemStaging');
const logger = require('../../config/logger');

/**
 * Contracts / Outline Agreements integration.
 *
 * This module assumes that:
 * - Contract header and supplier item CSVs have already been loaded into
 *   contract_header_staging and supplier_item_staging tables by an upstream
 *   ingestion process (SFTP -> DB).
 * - SAP-side creation/update of Outline Agreements is handled by SAP programs
 *   reading these staging tables and writing back SAP OA numbers & lines.
 *
 * This integration focuses on:
 * - Identifying contracts that have completed SAP processing.
 * - Updating Coupa Supplier Items with sap-oa-line.
 * - Publishing contracts and updating sap-oa on the contract header.
 */
async function execute(config) {
  const errors = [];
  let successCount = 0;
  let totalRecords = 0;

  try {
    logger.info('Starting contracts / outline agreements integration...');

    // 1) Fetch supplier items ready for Coupa update
    // Criteria: finished_update_sap_oa = TRUE AND finished_update_coupa_oa = FALSE
    const supplierItemsReadyForCoupa = await SupplierItemStaging.findReadyForCoupaUpdate();

    if (!supplierItemsReadyForCoupa || supplierItemsReadyForCoupa.length === 0) {
      logger.info('No supplier items ready for Coupa update');
      
      // Continue with contract header processing even if no supplier items
      const readyForCoupa = await ContractHeaderStaging.findReadyToUpdate();
      if (!readyForCoupa || readyForCoupa.length === 0) {
        return {
          successCount: 0,
          errorCount: 0,
          totalRecords: 0,
          errors: [],
        };
      }
    } else {
      logger.info(`Found ${supplierItemsReadyForCoupa.length} supplier items ready for Coupa update`);

      // 2) Update Supplier Items in Coupa using PUT API
      for (const item of supplierItemsReadyForCoupa) {
        if (!item.csin || !item.sap_oa_line) {
          logger.warn(`Skipping supplier item with missing CSIN or sap_oa_line: contract_id=${item.contract_id}, csin=${item.csin}`);
          continue;
        }

        try {
          // PUT API call to Coupa
          await CoupaClient.put(
            `/api/supplier_items/${encodeURIComponent(item.csin)}`,
            {
              id: item.csin,
              'custom-fields': {
                'sap-oa-line': item.sap_oa_line,
              },
            }
          );
          
          // Mark as finished updating Coupa
          await SupplierItemStaging.markFinishedCoupaUpdate(item.contract_id, item.csin);
          
          successCount += 1;
          totalRecords += 1;
          logger.info(`Successfully updated Coupa supplier item CSIN=${item.csin} (contract ${item.contract_id})`);
        } catch (error) {
          logger.error(
            `Failed to update Coupa supplier_item for CSIN=${item.csin} (contract ${item.contract_id}):`,
            error
          );
          errors.push({
            line_number: null,
            field_name: 'COUPA_SUPPLIER_ITEM',
            error_message: `Failed to update supplier item CSIN=${item.csin}: ${error.message}`,
            raw_payload: {
              contract_id: item.contract_id,
              csin: item.csin,
              sap_oa_line: item.sap_oa_line,
              response: error.response?.data,
              status: error.response?.status,
            },
          });
        }
      }
    }

    // 3) Fetch contract headers ready for Coupa update
    // Criteria: contract_id IS NOT NULL AND sap_oa_number IS NOT NULL AND finished_update_coupa_oa = FALSE
    const contractHeadersReadyForCoupa = await ContractHeaderStaging.findReadyForCoupaUpdate();

    if (contractHeadersReadyForCoupa && contractHeadersReadyForCoupa.length > 0) {
      logger.info(`Found ${contractHeadersReadyForCoupa.length} contract headers ready for Coupa update`);

      // 4) Update Contract Headers in Coupa using PUT API
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
          // PUT API call to Coupa
          await CoupaClient.put(
            `/api/contracts/${encodeURIComponent(contractId)}`,
            {
              id: contractId,
              'custom-fields': {
                'sap-oa': sapOaNumber,
              },
              status: 'published',
            }
          );

          // Mark as finished updating Coupa
          await ContractHeaderStaging.markFinishedCoupaUpdate(contractId);

          successCount += 1;
          totalRecords += 1;
          logger.info(`Successfully updated Coupa contract header Contract ID=${contractId} with SAP OA=${sapOaNumber}`);
        } catch (error) {
          logger.error(
            `Failed to update Coupa contract header for Contract ID=${contractId}:`,
            error
          );
          errors.push({
            line_number: null,
            field_name: 'COUPA_CONTRACT_HEADER',
            error_message: `Failed to update contract header ID=${contractId}: ${error.message}`,
            raw_payload: {
              contract_id: contractId,
              sap_oa_number: sapOaNumber,
              response: error.response?.data,
              status: error.response?.status,
            },
          });
        }
      }
    } else {
      logger.info('No contract headers ready for Coupa update');
    }

    // 5) Legacy: Fetch contracts that have finished SAP OA update and are ready to sync to Coupa
    // This section is kept for backward compatibility but may be deprecated
    const readyForCoupa = await ContractHeaderStaging.findReadyToUpdate();

    if (!readyForCoupa || readyForCoupa.length === 0) {
      logger.info('No contract headers ready for legacy Coupa sync');
    } else {
      logger.info(`Found ${readyForCoupa.length} contract headers ready for legacy Coupa sync`);

      for (const header of readyForCoupa) {
        const contractId = header.contract_id;

        try {
          totalRecords += 1;

          // Legacy: Publish Contract and update SAP OA number in Coupa (using POST)
          if (!contractId || !header.sap_oa_number) {
            logger.warn(
              `Skipping contract header sync to Coupa due to missing contractId or sap_oa_number (contractId=${contractId})`
            );
          } else {
            // 5a) Publish contract
            try {
              await CoupaClient.post(
                `/api/contracts/${encodeURIComponent(contractId)}`,
                {
                  id: contractId,
                  status: 'published',
                }
              );
              successCount += 1;
            } catch (error) {
              logger.error(
                `Failed to publish Coupa contract for Contract ID=${contractId}:`,
                error
              );
              errors.push({
                line_number: null,
                field_name: 'COUPA_CONTRACT_PUBLISH',
                error_message: `Failed to publish contract ID=${contractId}: ${error.message}`,
                raw_payload: {
                  contract_id: contractId,
                  response: error.response?.data,
                  status: error.response?.status,
                },
              });
            }

            // 5b) Update SAP OA number on contract header
            try {
              await CoupaClient.post(
                `/api/contracts/${encodeURIComponent(contractId)}`,
                {
                  id: contractId,
                  'custom-fields': {
                    'sap-oa': header.sap_oa_number,
                  },
                }
              );
              successCount += 1;
            } catch (error) {
              logger.error(
                `Failed to update SAP OA number on Coupa contract for Contract ID=${contractId}:`,
                error
              );
              errors.push({
                line_number: null,
                field_name: 'COUPA_CONTRACT_SAP_OA',
                error_message: `Failed to update SAP OA on contract ID=${contractId}: ${error.message}`,
                raw_payload: {
                  contract_id: contractId,
                  sap_oa_number: header.sap_oa_number,
                  response: error.response?.data,
                  status: error.response?.status,
                },
              });
            }
          }

          // 5c) Mark header as finished update to avoid re-processing
          try {
            await ContractHeaderStaging.markFinishedUpdate(contractId);
          } catch (error) {
            logger.warn(
              `Failed to mark contract header as finished_update_sap_oa for Contract ID=${contractId}:`,
              error
            );
            errors.push({
              line_number: null,
              field_name: 'STATUS_UPDATE',
              error_message: `Failed to mark contract header as finished: ${error.message}`,
              raw_payload: {
                contract_id: contractId,
              },
            });
          }
        } catch (error) {
          logger.error(
            `Unexpected error while processing contract header Contract ID=${contractId}:`,
            error
          );
          errors.push({
            line_number: null,
            field_name: 'SYSTEM',
            error_message: `System error for contract ID=${contractId}: ${error.message}`,
            raw_payload: {
              contract_id: contractId,
              stack: error.stack,
            },
          });
        }
      }
    }

    logger.info(
      `Contracts / outline agreements integration completed: ${successCount} successful operations, ${errors.length} errors`
    );

    return {
      successCount,
      errorCount: errors.length,
      totalRecords,
      errors,
    };
  } catch (error) {
    logger.error('Contracts / outline agreements integration failed:', error);

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


