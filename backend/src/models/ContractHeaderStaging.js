const pool = require('../config/database');
const logger = require('../config/logger');

class ContractHeaderStaging {
  static async upsert(data) {
    const {
      contract_id,
      contract_number,
      parent_number = null,
      status = 'NEW',
      ready_to_create_sap_oa = false,
      ready_to_update_sap_oa = false,
      finished_update_sap_oa = false,
      sap_oa_number = null,
    } = data;

    const query = `
      INSERT INTO contract_header_staging
        (contract_id, contract_number, parent_number, status,
         ready_to_create_sap_oa, ready_to_update_sap_oa, finished_update_sap_oa,
         sap_oa_number, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (contract_id)
      DO UPDATE SET
        contract_number = EXCLUDED.contract_number,
        parent_number = EXCLUDED.parent_number,
        status = EXCLUDED.status,
        ready_to_create_sap_oa = EXCLUDED.ready_to_create_sap_oa,
        ready_to_update_sap_oa = EXCLUDED.ready_to_update_sap_oa,
        finished_update_sap_oa = EXCLUDED.finished_update_sap_oa,
        sap_oa_number = EXCLUDED.sap_oa_number,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        contract_id,
        contract_number,
        parent_number,
        status,
        ready_to_create_sap_oa,
        ready_to_update_sap_oa,
        finished_update_sap_oa,
        sap_oa_number,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting contract header staging record:', error);
      throw error;
    }
  }

  static async upsertFromCsv(data) {
    const {
      contract_id,
      contract_number,
      parent_number = null,
      status = 'NEW',
      ready_to_create_sap_oa = false,
      ready_to_update_sap_oa = false,
      finished_update_sap_oa = false,
      sap_oa_number = null,
      // CSV-mapped fields
      ebeln = null,
      ctr_name = null,
      ctr_num = null,
      ctr_id = null,
      ctr_type = null,
      ctr_stat = null,
      own_login = null,
      comm_name = null,
      ctr_cdat = null,
      lifnr = null,
      lfa1_name1 = null,
      ekgrp = null,
      kdatb = null,
      ekorg = null,
      kdate = null,
      ctr_clog = null,
      waers = null,
      zterm = null,
      inco1 = null,
      ktwrt = null,
      ctr_updt = null,
      ekpo_pstyp = null,
      bukrs = null,
      crt_sapoa = null,
      upd_sapoa = null,
      amd_ctr_ty = null,
      ctrpa_id = null,
      ctrpa_name = null,
      ctrpa_num = null,
    } = data;

    // Map crt_sapoa and upd_sapoa strings to boolean flags
    const readyToCreate = ready_to_create_sap_oa || (crt_sapoa && crt_sapoa.toLowerCase() === 'yes');
    const readyToUpdate = ready_to_update_sap_oa || (upd_sapoa && upd_sapoa.toLowerCase() === 'yes');

    const query = `
      INSERT INTO contract_header_staging (
        contract_id, contract_number, parent_number, status,
        ready_to_create_sap_oa, ready_to_update_sap_oa, finished_update_sap_oa,
        sap_oa_number,
        ebeln, ctr_name, ctr_num, ctr_id, ctr_type, ctr_stat, own_login, comm_name,
        ctr_cdat, lifnr, lfa1_name1, ekgrp, kdatb, ekorg, kdate, ctr_clog,
        waers, zterm, inco1, ktwrt, ctr_updt, ekpo_pstyp, bukrs,
        crt_sapoa, upd_sapoa, amd_ctr_ty, ctrpa_id, ctrpa_name, ctrpa_num,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34, $35, $36, $37,
        NOW(), NOW()
      )
      ON CONFLICT (contract_id)
      DO UPDATE SET
        contract_number = EXCLUDED.contract_number,
        parent_number = EXCLUDED.parent_number,
        status = EXCLUDED.status,
        ready_to_create_sap_oa = EXCLUDED.ready_to_create_sap_oa,
        ready_to_update_sap_oa = EXCLUDED.ready_to_update_sap_oa,
        finished_update_sap_oa = EXCLUDED.finished_update_sap_oa,
        sap_oa_number = EXCLUDED.sap_oa_number,
        ebeln = EXCLUDED.ebeln,
        ctr_name = EXCLUDED.ctr_name,
        ctr_num = EXCLUDED.ctr_num,
        ctr_id = EXCLUDED.ctr_id,
        ctr_type = EXCLUDED.ctr_type,
        ctr_stat = EXCLUDED.ctr_stat,
        own_login = EXCLUDED.own_login,
        comm_name = EXCLUDED.comm_name,
        ctr_cdat = EXCLUDED.ctr_cdat,
        lifnr = EXCLUDED.lifnr,
        lfa1_name1 = EXCLUDED.lfa1_name1,
        ekgrp = EXCLUDED.ekgrp,
        kdatb = EXCLUDED.kdatb,
        ekorg = EXCLUDED.ekorg,
        kdate = EXCLUDED.kdate,
        ctr_clog = EXCLUDED.ctr_clog,
        waers = EXCLUDED.waers,
        zterm = EXCLUDED.zterm,
        inco1 = EXCLUDED.inco1,
        ktwrt = EXCLUDED.ktwrt,
        ctr_updt = EXCLUDED.ctr_updt,
        ekpo_pstyp = EXCLUDED.ekpo_pstyp,
        bukrs = EXCLUDED.bukrs,
        crt_sapoa = EXCLUDED.crt_sapoa,
        upd_sapoa = EXCLUDED.upd_sapoa,
        amd_ctr_ty = EXCLUDED.amd_ctr_ty,
        ctrpa_id = EXCLUDED.ctrpa_id,
        ctrpa_name = EXCLUDED.ctrpa_name,
        ctrpa_num = EXCLUDED.ctrpa_num,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        contract_id,
        contract_number,
        parent_number,
        status,
        readyToCreate,
        readyToUpdate,
        finished_update_sap_oa,
        sap_oa_number,
        ebeln, ctr_name, ctr_num, ctr_id, ctr_type, ctr_stat, own_login, comm_name,
        ctr_cdat, lifnr, lfa1_name1, ekgrp, kdatb, ekorg, kdate, ctr_clog,
        waers, zterm, inco1, ktwrt, ctr_updt, ekpo_pstyp, bukrs,
        crt_sapoa, upd_sapoa, amd_ctr_ty, ctrpa_id, ctrpa_name, ctrpa_num,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting contract header staging record from CSV:', error);
      throw error;
    }
  }

  static async findReadyToCreate() {
    const query = `
      SELECT *
      FROM contract_header_staging
      WHERE ready_to_create_sap_oa = TRUE
        AND sap_oa_number IS NULL
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching ready-to-create contract headers:', error);
      throw error;
    }
  }

  static async findReadyToUpdate() {
    const query = `
      SELECT *
      FROM contract_header_staging
      WHERE ready_to_update_sap_oa = TRUE
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching ready-to-update contract headers:', error);
      throw error;
    }
  }

  static async markFinishedUpdate(contractId) {
    const query = `
      UPDATE contract_header_staging
      SET finished_update_sap_oa = TRUE,
          updated_at = NOW()
      WHERE contract_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error marking contract header update as finished:', error);
      throw error;
    }
  }

  static async updateSapOaNumber(contractId, sapOaNumber) {
    const query = `
      UPDATE contract_header_staging
      SET sap_oa_number = $2,
          updated_at = NOW()
      WHERE contract_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId, sapOaNumber]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating SAP OA number on contract header staging:', error);
      throw error;
    }
  }

  /**
   * Find contract header by CTR_ID
   */
  static async findByCtrId(ctrId) {
    const query = `
      SELECT *
      FROM contract_header_staging
      WHERE ctr_id = $1
      LIMIT 1
    `;

    try {
      const result = await pool.query(query, [ctrId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding contract header by CTR_ID:', error);
      throw error;
    }
  }

  /**
   * Update CRT_SAPOA and UPD_SAPOA flags based on values
   */
  static async updateSapOaFlags(contractId, crtSapoa, updSapoa) {
    // Map 'Y' to boolean for ready flags
    const readyToCreate = crtSapoa && (crtSapoa.toString().toUpperCase() === 'Y' || crtSapoa === true);
    // Only set ready_to_update_sap_oa if updSapoa is explicitly 'Y', otherwise keep current value or false
    const readyToUpdate = updSapoa && (updSapoa.toString().toUpperCase() === 'Y' || updSapoa === true);

    const query = `
      UPDATE contract_header_staging
      SET crt_sapoa = $2,
          upd_sapoa = COALESCE($3, upd_sapoa),
          ready_to_create_sap_oa = $4,
          ready_to_update_sap_oa = CASE WHEN $3 IS NOT NULL THEN $5 ELSE ready_to_update_sap_oa END,
          updated_at = NOW()
      WHERE contract_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId, crtSapoa, updSapoa, readyToCreate, readyToUpdate]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating SAP OA flags on contract header staging:', error);
      throw error;
    }
  }

  /**
   * Check if CTR_NUM already exists in the table
   */
  static async existsByCtrNum(ctrNum) {
    if (!ctrNum) {
      return false;
    }

    const query = `
      SELECT EXISTS(
        SELECT 1
        FROM contract_header_staging
        WHERE ctr_num = $1
      ) as exists
    `;

    try {
      const result = await pool.query(query, [ctrNum]);
      return result.rows[0]?.exists || false;
    } catch (error) {
      logger.error('Error checking if CTR_NUM exists:', error);
      throw error;
    }
  }

  /**
   * Find contract headers ready for Coupa update
   * Criteria: sap_oa_number IS NOT NULL AND sap_oa_number != '' AND finished_update_coupa_oa = FALSE
   */
  static async findReadyForCoupaUpdate() {
    const query = `
      SELECT *
      FROM contract_header_staging
      WHERE sap_oa_number IS NOT NULL
        AND sap_oa_number != ''
        AND finished_update_coupa_oa = FALSE
        AND contract_id IS NOT NULL
      ORDER BY contract_id
    `;

    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching contract headers ready for Coupa update:', error);
      throw error;
    }
  }

  /**
   * Mark contract header as finished updating Coupa
   */
  static async markFinishedCoupaUpdate(contractId) {
    const query = `
      UPDATE contract_header_staging
      SET finished_update_coupa_oa = TRUE,
          updated_at = NOW()
      WHERE contract_id = $1
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [contractId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error marking contract header as finished Coupa update:', error);
      throw error;
    }
  }
}

module.exports = ContractHeaderStaging;


