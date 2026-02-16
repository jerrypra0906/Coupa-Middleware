const { Readable } = require('stream');
const path = require('path');
const csvParser = require('csv-parser');
const SFTPService = require('../../services/sftp/sftpService');
const sftpConfig = require('../../config/sftp');
const SupplierItemStaging = require('../../models/SupplierItemStaging');
const ContractHeaderStaging = require('../../models/ContractHeaderStaging');
const TransformationService = require('../../services/transformation/transformationService');
const logger = require('../../config/logger');

function parseCsvString(content) {
  return new Promise((resolve, reject) => {
    const records = [];
    Readable.from([content])
      .pipe(csvParser())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', (err) => reject(err));
  });
}

function mapCsvRowToStaging(row) {
  const toInt = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseInt(String(val).trim(), 10);
    return Number.isNaN(n) ? null : n;
  };

  const toDecimal = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = Number(String(val).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  };

  const parseDate = (val) => {
    if (!val) return null;
    return TransformationService.parseSapDate(val);
  };

  // Helper function to find column value with case-insensitive and trimmed matching
  const findColumnValue = (possibleNames) => {
    if (!row) return null;
    
    const rowKeys = Object.keys(row);
    
    // Debug: Log what we're looking for and what's available (only for contract number to avoid spam)
    if (possibleNames[0] && possibleNames[0].toLowerCase().includes('contract')) {
      logger.debug(`Looking for contract number. Possible names: ${possibleNames.join(', ')}`);
      logger.debug(`Available row keys: ${rowKeys.join(', ')}`);
    }
    
    // First try exact matches (including with spaces)
    for (const name of possibleNames) {
      if (row.hasOwnProperty(name) && row[name] !== undefined && row[name] !== null && row[name] !== '') {
        if (possibleNames[0] && possibleNames[0].toLowerCase().includes('contract')) {
          logger.debug(`Found exact match for "${name}": ${row[name]}`);
        }
        return row[name];
      }
    }
    
    // Then try case-insensitive matching with normalized comparison
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ');
      for (const key of rowKeys) {
        const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ');
        if (normalizedKey === normalizedName) {
          if (possibleNames[0] && possibleNames[0].toLowerCase().includes('contract')) {
            logger.debug(`Found case-insensitive match: "${key}" matches "${name}", value: ${row[key]}`);
          }
          return row[key];
        }
      }
    }
    
    // Also try matching without spaces (for cases like "ContractNumber" vs "Contract Number")
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
      for (const key of rowKeys) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
        if (normalizedKey === normalizedName) {
          if (possibleNames[0] && possibleNames[0].toLowerCase().includes('contract')) {
            logger.debug(`Found space-normalized match: "${key}" matches "${name}", value: ${row[key]}`);
          }
          return row[key];
        }
      }
    }
    
    if (possibleNames[0] && possibleNames[0].toLowerCase().includes('contract')) {
      logger.warn(`Could not find contract number column. Tried: ${possibleNames.join(', ')}`);
    }
    
    return null;
  };

  // Use exact column names from the actual CSV file (SupplierItem_20260213_065727Z.csv)
  // Column names are preserved exactly as they appear in the CSV header
  const contractNumber = row['Contract Number'] || null;
  const csin = row['Coupa Supplier Internal Number'] || null;
  const ctrId = toInt(row['Contract ID'] || null);

  // Map all fields using exact column names from the actual CSV file
  // Column names match exactly as they appear in the CSV header row
  const sapOaLine = row['sap_oasap_oa_line'] || null;
  const ebeln = null; // Not in CSV - SAP Contract Number not present
  const ebelp = null; // Not in CSV - SAP Contract Line Number not present
  const ctmName = row['Name'] || null;
  const ctmPlant = row['Supplier Part Num'] || null;
  const supApnm = row['Supplier Aux Part Num'] || null;
  const ctmDesc = row['Description'] || null;
  const ekpoMatnr = row['Item Number'] || null;
  const ekpoMeins = row['UOM Code'] || null;
  const pricePer = null; // Not in CSV - Price Per not present
  const priceValue = row['Price'] || null;
  const currencyVal = row['Currency'] || null;
  const supQty = null; // Not in CSV - Supply Quantity not present
  const ctmAvail = row['Availability'] || null;
  const supMoq = row['Supplier Minimum Order Quantity'] || null;
  const ctmClog = row['Created By (Login)'] || null;
  const ctmUlog = row['Updated By (Login)'] || null;
  const ctmCdat = row['Created At'] || null;
  const ctmUdat = row['Updated At'] || null;
  const ctmItxt = row['Item Commodity SAP Code'] || null;
  const ctmInco = row['incoterm_location'] || null;
  const cin = row['Coupa Internal Number'] || null;
  const crtSapoa = null; // Not in CSV - internal flag
  const updSapoa = null; // Not in CSV - internal flag

  return {
    contract_id: contractNumber ? String(contractNumber).trim() : null,
    csin: csin ? String(csin).trim() : null,

    status: 'NEW',
    sap_oa_number: null,
    sap_oa_line: sapOaLine ? String(sapOaLine).trim() : null,
    finished_update_sap_oa: false,
    ctr_id: ctrId,

    ctm_cnum: contractNumber ? String(contractNumber).trim() : null,
    ebeln: ebeln ? String(ebeln).trim() : null,
    ebelp: ebelp ? String(ebelp).trim() : null,
    ctm_name: ctmName ? String(ctmName).trim() : null,
    ctm_plant: ctmPlant ? String(ctmPlant).trim() : null,
    sup_apnm: supApnm ? String(supApnm).trim() : null,
    ctm_desc: ctmDesc ? String(ctmDesc).trim() : null,
    ekpo_matnr: ekpoMatnr ? String(ekpoMatnr).trim() : null,
    ekpo_meins: ekpoMeins ? String(ekpoMeins).trim() : null,
    ekpo_netpr: toDecimal(priceValue), // Price maps to EKPO_NETPR according to Excel
    price_per: toDecimal(pricePer),
    price_value: toDecimal(priceValue), // Price also maps to PRICE_VALUE
    currency: currencyVal ? String(currencyVal).trim() : null,
    sup_qty: toInt(supQty),
    ctm_avail: ctmAvail ? String(ctmAvail).trim() : null,
    sup_moq: toInt(supMoq),
    ctm_clog: ctmClog ? String(ctmClog).trim() : null,
    ctm_ulog: ctmUlog ? String(ctmUlog).trim() : null,
    ctm_cdat: parseDate(ctmCdat),
    ctm_udat: parseDate(ctmUdat),
    ctm_itxt: ctmItxt ? String(ctmItxt).trim() : null,
    ctm_inco: ctmInco ? String(ctmInco).trim() : null,
    cin: cin ? String(cin).trim() : null,
    crt_sapoa: crtSapoa ? String(crtSapoa).trim() : null,
    upd_sapoa: updSapoa ? String(updSapoa).trim() : null,
  };
}

async function execute(config) {
  const errors = [];
  let successCount = 0;
  let totalRecords = 0;

  try {
    logger.info('Starting supplier item CSV ingestion from SFTP...');

    let configJson = {};
    if (config.config_json) {
      if (typeof config.config_json === 'string') {
        try {
          configJson = JSON.parse(config.config_json);
        } catch (e) {
          logger.warn('Failed to parse config_json for supplier item ingestion, using empty object');
        }
      } else {
        configJson = config.config_json;
      }
    }
    
    logger.info(`Supplier item ingestion config: sftp_folder=${configJson.sftp_folder}, archive_path=${configJson.archive_path}`);

    const folder = configJson.sftp_folder || null;

    const files = await SFTPService.getNewFiles(folder);
    if (!files || files.length === 0) {
      logger.info(`No supplier item CSV files found in SFTP folder: ${folder}`);
      return {
        successCount: 0,
        errorCount: 0,
        totalRecords: 0,
        errors: [],
      };
    }

    logger.info(`Found ${files.length} supplier item files in folder ${folder}`);

    const processedFiles = []; // Track successfully processed files for archiving

    for (const file of files) {
      if (file.type !== '-' || !file.name.toLowerCase().endsWith('.csv')) {
        continue;
      }

      let remoteFilePath;
      if (!folder) {
        remoteFilePath = `${sftpConfig.incomingPath}/${file.name}`.replace(/\/+/g, '/');
      } else if (folder.startsWith('/')) {
        remoteFilePath = `${folder}/${file.name}`.replace(/\/+/g, '/');
      } else {
        remoteFilePath = `${sftpConfig.incomingPath}/${folder}/${file.name}`.replace(/\/+/g, '/');
      }
      logger.info(`Processing supplier item CSV: ${remoteFilePath}`);

      let csvContent;
      try {
        csvContent = await SFTPService.downloadCSV(remoteFilePath);
      } catch (error) {
        logger.error(`Failed to download supplier item CSV ${remoteFilePath}:`, error);
        errors.push({
          line_number: null,
          field_name: 'SFTP_DOWNLOAD',
          error_message: `Failed to download file ${remoteFilePath}: ${error.message}`,
          raw_payload: {
            file: remoteFilePath,
            code: error.code,
          },
        });
        continue;
      }

      let rows;
      try {
        rows = await parseCsvString(csvContent);
      } catch (error) {
        logger.error(`Failed to parse CSV content for ${remoteFilePath}:`, error);
        errors.push({
          line_number: null,
          field_name: 'CSV_PARSE',
          error_message: `Failed to parse CSV for file ${remoteFilePath}: ${error.message}`,
          raw_payload: { file: remoteFilePath },
        });
        continue;
      }

      totalRecords += rows.length;
      let fileSuccessCount = 0;
      let fileErrorCount = 0;

      for (let idx = 0; idx < rows.length; idx += 1) {
        const row = rows[idx];
        const lineNumber = idx + 2;

        try {
          // Debug: Log available columns for first row to help diagnose column name issues
          if (idx === 0) {
            logger.info(`[DEBUG] Available columns in CSV: ${Object.keys(row).join(', ')}`);
            logger.info(`[DEBUG] Sample row data: ${JSON.stringify(row)}`);
            logger.info(`[DEBUG] Direct check - row['Contract Number']: ${JSON.stringify(row['Contract Number'])}`);
            logger.info(`[DEBUG] Direct check - row['Contract number']: ${JSON.stringify(row['Contract number'])}`);
          }

          const stagingData = mapCsvRowToStaging(row);
          
          // Debug: Log what we extracted
          if (idx === 0) {
            logger.info(`[DEBUG] Extracted contract_id: ${stagingData.contract_id}, csin: ${stagingData.csin}, ctr_id: ${stagingData.ctr_id}`);
          }
          
          if (!stagingData.contract_id) {
            // Provide more detailed error message with available columns
            const allColumns = Object.keys(row);
            const contractRelatedColumns = allColumns.filter(k => 
              k.toLowerCase().includes('contract') || k.toLowerCase().includes('number')
            );
            logger.error(`[ERROR] Line ${lineNumber} - Missing contract_id`);
            logger.error(`[ERROR] All columns: ${allColumns.join(', ')}`);
            logger.error(`[ERROR] Contract-related columns: ${contractRelatedColumns.join(', ')}`);
            logger.error(`[ERROR] Full row data: ${JSON.stringify(row)}`);
            logger.error(`[ERROR] Direct access - row['Contract Number']: ${JSON.stringify(row['Contract Number'])}`);
            logger.error(`[ERROR] Direct access - row['Contract number']: ${JSON.stringify(row['Contract number'])}`);
            throw new Error(`Missing contract number. Available columns: ${allColumns.join(', ')}. Contract-related: ${contractRelatedColumns.join(', ')}`);
          }
          if (!stagingData.csin) {
            throw new Error('Missing Coupa Supplier Internal Number (CSIN)');
          }

          // Check if a record exists with the same CTM_CNUM, EKPO_MATNR, EKPO_MEINS, and CSIN
          // If all 4 fields match, this is an update - set UPD_SAPOA = 'Y'
          if (stagingData.ctm_cnum && stagingData.ekpo_matnr && stagingData.ekpo_meins && stagingData.csin) {
            try {
              const exists = await SupplierItemStaging.existsByCompositeKey(
                stagingData.ctm_cnum,
                stagingData.ekpo_matnr,
                stagingData.ekpo_meins,
                stagingData.csin
              );
              if (exists) {
                // All 4 fields match an existing record, this is an update - set UPD_SAPOA = 'Y'
                stagingData.upd_sapoa = 'Y';
                logger.debug(
                  `Composite key exists (CTM_CNUM=${stagingData.ctm_cnum}, EKPO_MATNR=${stagingData.ekpo_matnr}, ` +
                  `EKPO_MEINS=${stagingData.ekpo_meins}, CSIN=${stagingData.csin}), setting UPD_SAPOA = 'Y'`
                );
              }
            } catch (checkError) {
              // Log but don't fail the record ingestion
              logger.warn(
                `Failed to check if composite key exists (CTM_CNUM=${stagingData.ctm_cnum}, ` +
                `EKPO_MATNR=${stagingData.ekpo_matnr}, EKPO_MEINS=${stagingData.ekpo_meins}, CSIN=${stagingData.csin}):`,
                checkError
              );
            }
          }

          // Upsert supplier item
          await SupplierItemStaging.upsertFromCsv(stagingData);

          // Check if CTR_ID exists in contract_header_staging
          if (stagingData.ctr_id) {
            try {
              const contractHeader = await ContractHeaderStaging.findByCtrId(stagingData.ctr_id);
              
              if (contractHeader) {
                // CTR_ID exists in contract_header_staging
                // Update both tables' CRT_SAPOA to 'Y', leave UPD_SAPOA blank
                const crtSapoa = 'Y';
                const updSapoa = null; // Keep blank

                // Update supplier_item_staging
                await SupplierItemStaging.updateSapOaFlags(
                  stagingData.contract_id,
                  stagingData.csin,
                  crtSapoa,
                  updSapoa
                );

                // Update contract_header_staging
                await ContractHeaderStaging.updateSapOaFlags(
                  contractHeader.contract_id,
                  crtSapoa,
                  updSapoa
                );

                logger.info(
                  `Updated CRT_SAPOA to 'Y' for CTR_ID=${stagingData.ctr_id} ` +
                  `(contract_id=${stagingData.contract_id}, csin=${stagingData.csin})`
                );
              } else {
                logger.debug(
                  `CTR_ID=${stagingData.ctr_id} not found in contract_header_staging, skipping flag update`
                );
              }
            } catch (flagError) {
              // Log but don't fail the record ingestion
              logger.warn(
                `Failed to update SAP OA flags for CTR_ID=${stagingData.ctr_id}:`,
                flagError
              );
            }
          }

          successCount += 1;
          fileSuccessCount += 1;
        } catch (error) {
          logger.error(
            `Failed to upsert supplier item staging record at line ${lineNumber}:`,
            error
          );
          errors.push({
            line_number: lineNumber,
            field_name: 'DATABASE',
            error_message: `Failed to save supplier item from line ${lineNumber}: ${error.message}`,
            raw_payload: row,
          });
          fileErrorCount += 1;
        }
      }

      // If file was processed successfully (at least some records succeeded), mark for archiving
      if (fileSuccessCount > 0) {
        processedFiles.push(remoteFilePath);
        logger.info(`File ${remoteFilePath} marked for archiving (${fileSuccessCount} records succeeded)`);
      } else {
        logger.info(`File ${remoteFilePath} NOT marked for archiving (0 records succeeded, ${fileErrorCount} errors)`);
      }
    }

    // Archive successfully processed files
    logger.info(`Archive check: processedFiles.length = ${processedFiles.length}, archive_path = ${configJson.archive_path}`);
    if (processedFiles.length > 0 && configJson.archive_path) {
      const archiveFolder = configJson.archive_path;
      logger.info(`Archiving ${processedFiles.length} successfully processed files to ${archiveFolder}`);
      
      for (const filePath of processedFiles) {
        try {
          const filename = path.basename(filePath);
          const archivePath = `${archiveFolder}/${filename}`.replace(/\/+/g, '/');
          logger.info(`Attempting to move file: ${filePath} -> ${archivePath}`);
          await SFTPService.moveFile(filePath, archivePath);
          logger.info(`Successfully archived supplier item file: ${filePath} -> ${archivePath}`);
        } catch (error) {
          logger.error(`Failed to archive file ${filePath}:`, error);
          // Don't fail the entire job if archiving fails, just log the error
          errors.push({
            line_number: null,
            field_name: 'ARCHIVE',
            error_message: `Failed to archive file ${filePath}: ${error.message}`,
            raw_payload: { file: filePath },
          });
        }
      }
    } else if (processedFiles.length > 0 && !configJson.archive_path) {
      logger.warn(`Files were processed but archive_path is not configured. Skipping archiving.`);
    } else {
      logger.info(`No files to archive (processedFiles.length = ${processedFiles.length})`);
    }

    logger.info(
      `Supplier item ingestion completed: ${successCount} records upserted, ${errors.length} errors`
    );

    return {
      successCount,
      errorCount: errors.length,
      totalRecords,
      errors,
    };
  } catch (error) {
    logger.error('Supplier item ingestion failed:', error);

    if (!errors.some((e) => e.field_name === 'SYSTEM')) {
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


