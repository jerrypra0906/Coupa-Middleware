const pool = require('../config/database');
const logger = require('../config/logger');

class SupplierItemStaging {
  static async upsert(data) {
    const {
      contract_id,
      csin,
      status = 'NEW',
      sap_oa_number = null,
      sap_oa_line = null,
      finished_update_sap_oa = false,
    } = data;

    const query = `
      INSERT INTO supplier_item_staging
        (contract_id, csin, status, sap_oa_number, sap_oa_line, finished_update_sap_oa, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (contract_id, csin)
      DO UPDATE SET
        status = EXCLUDED.status,
        sap_oa_number = EXCLUDED.sap_oa_number,
        sap_oa_line = EXCLUDED.sap_oa_line,
        finished_update_sap_oa = EXCLUDED.finished_update_sap_oa,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        contract_id,
        csin,
        status,
        sap_oa_number,
        sap_oa_line,
        finished_update_sap_oa,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting supplier item staging record:', error);
      throw error;
    }
  }

  static async upsertFromCsv(data) {
    const {
      contract_id,
      csin,
      status = 'NEW',
      sap_oa_number = null,
      sap_oa_line = null,
      finished_update_sap_oa = false,
      ctr_id = null,
      ctm_cnum = null,
      ebeln = null,
      ebelp = null,
      ctm_name = null,
      ctm_plant = null,
      sup_apnm = null,
      ctm_desc = null,
      ekpo_matnr = null,
      ekpo_meins = null,
      ekpo_netpr = null,
      price_per = null,
      price_value = null,
      currency = null,
      sup_qty = null,
      ctm_avail = null,
      sup_moq = null,
      ctm_clog = null,
      ctm_ulog = null,
      ctm_cdat = null,
      ctm_udat = null,
      ctm_itxt = null,
      ctm_inco = null,
      cin = null,
      crt_sapoa = null,
      upd_sapoa = null,
    } = data;

    const query = `
      INSERT INTO supplier_item_staging (
        contract_id, csin, status, sap_oa_number, sap_oa_line, finished_update_sap_oa, ctr_id,
        ctm_cnum, ebeln, ebelp, ctm_name, ctm_plant, sup_apnm, ctm_desc,
        ekpo_matnr, ekpo_meins, ekpo_netpr, price_per, price_value, currency,
        sup_qty, ctm_avail, sup_moq, ctm_clog, ctm_ulog, ctm_cdat, ctm_udat,
        ctm_itxt, ctm_inco, cin, crt_sapoa, upd_sapoa,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32,
        NOW(), NOW()
      )
      ON CONFLICT (contract_id, csin)
      DO UPDATE SET
        status = EXCLUDED.status,
        sap_oa_number = EXCLUDED.sap_oa_number,
        sap_oa_line = EXCLUDED.sap_oa_line,
        finished_update_sap_oa = EXCLUDED.finished_update_sap_oa,
        ctr_id = EXCLUDED.ctr_id,
        ctm_cnum = EXCLUDED.ctm_cnum,
        ebeln = EXCLUDED.ebeln,
        ebelp = EXCLUDED.ebelp,
        ctm_name = EXCLUDED.ctm_name,
        ctm_plant = EXCLUDED.ctm_plant,
        sup_apnm = EXCLUDED.sup_apnm,
        ctm_desc = EXCLUDED.ctm_desc,
        ekpo_matnr = EXCLUDED.ekpo_matnr,
        ekpo_meins = EXCLUDED.ekpo_meins,
        ekpo_netpr = EXCLUDED.ekpo_netpr,
        price_per = EXCLUDED.price_per,
        price_value = EXCLUDED.price_value,
        currency = EXCLUDED.currency,
        sup_qty = EXCLUDED.sup_qty,
        ctm_avail = EXCLUDED.ctm_avail,
        sup_moq = EXCLUDED.sup_moq,
        ctm_clog = EXCLUDED.ctm_clog,
        ctm_ulog = EXCLUDED.ctm_ulog,
        ctm_cdat = EXCLUDED.ctm_cdat,
        ctm_udat = EXCLUDED.ctm_udat,
        ctm_itxt = EXCLUDED.ctm_itxt,
        ctm_inco = EXCLUDED.ctm_inco,
        cin = EXCLUDED.cin,
        crt_sapoa = EXCLUDED.crt_sapoa,
        upd_sapoa = EXCLUDED.upd_sapoa,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        contract_id,
        csin,
        status,
        sap_oa_number,
        sap_oa_line,
        finished_update_sap_oa,
        ctr_id,
        ctm_cnum,
        ebeln,
        ebelp,
        ctm_name,
        ctm_plant,
        sup_apnm,
        ctm_desc,
        ekpo_matnr,
        ekpo_meins,
        ekpo_netpr,
        price_per,
        price_value,
        currency,
        sup_qty,
        ctm_avail,
        sup_moq,
        ctm_clog,
        ctm_ulog,
        ctm_cdat,
        ctm_udat,
        ctm_itxt,
        ctm_inco,
        cin,
        crt_sapoa,
        upd_sapoa,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting supplier item staging record from CSV:', error);
      throw error;
    }
  }

  static async findByContract(contractId) {
    const query = `
      SELECT *
      FROM supplier_item_staging
      WHERE contract_id = $1
      ORDER BY csin
    `;

    try {
      const result = await pool.query(query, [contractId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching supplier items by contract:', error);
      throw error;
    }
  }

  static async findWithoutSapOaLine() {
    const query = `
      SELECT *
      FROM supplier_item_staging
      WHERE sap_oa_line IS NULL
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching supplier items without SAP OA line:', error);
      throw error;
    }
  }

  static async updateSapOaData(contractId, csin, sapOaNumber, sapOaLine) {
    const query = `
      UPDATE supplier_item_staging
      SET sap_oa_number = $3,
          sap_oa_line = $4,
          updated_at = NOW()
      WHERE contract_id = $1 AND csin = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId, csin, sapOaNumber, sapOaLine]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating SAP OA data on supplier item staging:', error);
      throw error;
    }
  }

  /**
   * Find supplier items ready for Coupa update
   * Criteria: sap_oa_line IS NOT NULL AND sap_oa_line != '' AND finished_update_coupa_oa = FALSE
   */
  static async findReadyForCoupaUpdate() {
    const query = `
      SELECT *
      FROM supplier_item_staging
      WHERE sap_oa_line IS NOT NULL
        AND sap_oa_line != ''
        AND finished_update_coupa_oa = FALSE
        AND csin IS NOT NULL
      ORDER BY contract_id, csin
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching supplier items ready for Coupa update:', error);
      throw error;
    }
  }

  /**
   * Mark supplier item as finished updating Coupa
   */
  static async markFinishedCoupaUpdate(contractId, csin) {
    const query = `
      UPDATE supplier_item_staging
      SET finished_update_coupa_oa = TRUE,
          updated_at = NOW()
      WHERE contract_id = $1 AND csin = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId, csin]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error marking supplier item as finished Coupa update:', error);
      throw error;
    }
  }

  /**
   * Update CRT_SAPOA and UPD_SAPOA flags
   */
  static async updateSapOaFlags(contractId, csin, crtSapoa, updSapoa) {
    const query = `
      UPDATE supplier_item_staging
      SET crt_sapoa = $3,
          upd_sapoa = $4,
          updated_at = NOW()
      WHERE contract_id = $1 AND csin = $2
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId, csin, crtSapoa, updSapoa]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating SAP OA flags on supplier item staging:', error);
      throw error;
    }
  }

  /**
   * Check if CTM_CNUM already exists in the table
   */
  static async existsByCtmCnum(ctmCnum) {
    if (!ctmCnum) {
      return false;
    }

    const query = `
      SELECT EXISTS(
        SELECT 1
        FROM supplier_item_staging
        WHERE ctm_cnum = $1
      ) as exists
    `;

    try {
      const result = await pool.query(query, [ctmCnum]);
      return result.rows[0]?.exists || false;
    } catch (error) {
      logger.error('Error checking if CTM_CNUM exists:', error);
      throw error;
    }
  }

  /**
   * Check if a record exists with the same CTM_CNUM, EKPO_MATNR, EKPO_MEINS, and CSIN
   * Used to determine if UPD_SAPOA should be set to 'Y'
   */
  static async existsByCompositeKey(ctmCnum, ekpoMatnr, ekpoMeins, csin) {
    if (!ctmCnum || !ekpoMatnr || !ekpoMeins || !csin) {
      return false;
    }

    const query = `
      SELECT EXISTS(
        SELECT 1
        FROM supplier_item_staging
        WHERE ctm_cnum = $1
          AND ekpo_matnr = $2
          AND ekpo_meins = $3
          AND csin = $4
      ) as exists
    `;

    try {
      const result = await pool.query(query, [ctmCnum, ekpoMatnr, ekpoMeins, csin]);
      return result.rows[0]?.exists || false;
    } catch (error) {
      logger.error('Error checking if composite key exists:', error);
      throw error;
    }
  }
}

module.exports = SupplierItemStaging;


