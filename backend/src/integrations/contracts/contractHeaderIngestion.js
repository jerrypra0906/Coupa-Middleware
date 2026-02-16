const { Readable } = require('stream');
const path = require('path');
const csvParser = require('csv-parser');
const SFTPService = require('../../services/sftp/sftpService');
const sftpConfig = require('../../config/sftp');
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
  // Helper to parse integers safely
  const toInt = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = parseInt(String(val).trim(), 10);
    return Number.isNaN(n) ? null : n;
  };

  const parseDate = (val) => {
    if (!val) return null;
    return TransformationService.parseSapDate(val);
  };

  const ctrId = row['ID'];
  const contractNumber = row['Contract #'];

  return {
    // Use Contract Number as the shared identifier across header & items
    contract_id: contractNumber ? String(contractNumber).trim() : null,
    contract_number: contractNumber || null,
    parent_number: row['parent number'] || null,
    status: 'NEW',

    // Mapped business fields
    ebeln: row['SAP OA'] || null,
    ctr_name: row['Contract Name'] || null,
    ctr_num: row['Contract #'] || null,
    ctr_id: toInt(row['ID']),
    ctr_type: row['contract_type name'] || null,
    ctr_stat: row['Status'] || null,
    own_login: row['Owner Login'] || null,
    comm_name: row['contract-detail-commodity-name'] || null,
    ctr_cdat: parseDate(row['Created Date']),
    lifnr: toInt(row['Supplier Number']),
    lfa1_name1: row['Supplier'] || null,
    ekgrp: row['purchasing_group external_ref_code'] || null,
    kdatb: parseDate(row['Starts']),
    ekorg: row['Content Groups'] || null,
    kdate: parseDate(row['Expires']),
    ctr_clog: toInt(row['Created By Login']),
    waers: row['Currency Code'] || null,
    zterm: row['payment_term code'] || null,
    inco1: row['shipping_term code'] || null,
    ktwrt: toInt(row['maximum_value']),
    ctr_updt: parseDate(row['Updated Date']),
    ekpo_pstyp: row['item_category'] || null,
    bukrs: row['company_code external_ref_code'] || null,
    crt_sapoa: row['Ready to Create SAP OA'] || null,
    upd_sapoa: row['Ready to Update SAP OA'] || null,
    amd_ctr_ty: row['amended_contract_type'] || null,
    ctrpa_id: toInt(row['parent id']),
    ctrpa_name: row['parent name'] || null,
    ctrpa_num: row['parent number'] || null,
  };
}

async function execute(config) {
  const errors = [];
  let successCount = 0;
  let totalRecords = 0;

  try {
    logger.info('Starting contract header CSV ingestion from SFTP...');

    // Resolve config_json (can be JSON string or object)
    let configJson = {};
    if (config.config_json) {
      if (typeof config.config_json === 'string') {
        try {
          configJson = JSON.parse(config.config_json);
        } catch (e) {
          logger.warn('Failed to parse config_json for contract header ingestion, using empty object');
        }
      } else {
        configJson = config.config_json;
      }
    }
    
    logger.info(`Contract header ingestion config: sftp_folder=${configJson.sftp_folder}, archive_path=${configJson.archive_path}`);

    const folder = configJson.sftp_folder || null;

    // Get list of files in the incoming folder
    const files = await SFTPService.getNewFiles(folder);
    if (!files || files.length === 0) {
      logger.info(`No contract header CSV files found in SFTP folder: ${folder}`);
      return {
        successCount: 0,
        errorCount: 0,
        totalRecords: 0,
        errors: [],
      };
    }

    logger.info(`Found ${files.length} contract header files in folder ${folder}`);

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
      logger.info(`Processing contract header CSV: ${remoteFilePath}`);

      let csvContent;
      try {
        csvContent = await SFTPService.downloadCSV(remoteFilePath);
      } catch (error) {
        logger.error(`Failed to download contract header CSV ${remoteFilePath}:`, error);
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
        const lineNumber = idx + 2; // header is line 1

        try {
          const stagingData = mapCsvRowToStaging(row);
          if (!stagingData.contract_id) {
            throw new Error('Missing contract ID (Contract Number)');
          }

          // Check if CTR_NUM already exists - if so, set UPD_SAPOA = 'Y'
          if (stagingData.ctr_num) {
            try {
              const exists = await ContractHeaderStaging.existsByCtrNum(stagingData.ctr_num);
              if (exists) {
                // CTR_NUM exists, this is an update - set UPD_SAPOA = 'Y'
                stagingData.upd_sapoa = 'Y';
                logger.debug(`CTR_NUM ${stagingData.ctr_num} exists, setting UPD_SAPOA = 'Y'`);
              }
            } catch (checkError) {
              // Log but don't fail the record ingestion
              logger.warn(`Failed to check if CTR_NUM exists for ${stagingData.ctr_num}:`, checkError);
            }
          }

          await ContractHeaderStaging.upsertFromCsv(stagingData);
          successCount += 1;
          fileSuccessCount += 1;
        } catch (error) {
          logger.error(`Failed to upsert contract header staging record at line ${lineNumber}:`, error);
          errors.push({
            line_number: lineNumber,
            field_name: 'DATABASE',
            error_message: `Failed to save contract header from line ${lineNumber}: ${error.message}`,
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
      // Get archive path from config
      const archiveFolder = configJson.archive_path;
      logger.info(`Archiving ${processedFiles.length} successfully processed files to ${archiveFolder}`);
      
      for (const filePath of processedFiles) {
        try {
          const filename = path.basename(filePath);
          const archivePath = `${archiveFolder}/${filename}`.replace(/\/+/g, '/');
          logger.info(`Attempting to move file: ${filePath} -> ${archivePath}`);
          await SFTPService.moveFile(filePath, archivePath);
          logger.info(`Successfully archived contract header file: ${filePath} -> ${archivePath}`);
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
      `Contract header ingestion completed: ${successCount} records upserted, ${errors.length} errors`
    );

    return {
      successCount,
      errorCount: errors.length,
      totalRecords,
      errors,
    };
  } catch (error) {
    logger.error('Contract header ingestion failed:', error);

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


