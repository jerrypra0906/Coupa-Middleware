-- Contract Header and Supplier Item Staging for Coupa Contract Integration

CREATE TABLE IF NOT EXISTS contract_header_staging (
    id SERIAL PRIMARY KEY,
    contract_id VARCHAR(100) NOT NULL UNIQUE,
    contract_number VARCHAR(100),
    parent_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'NEW' CHECK (status IN ('NEW', 'PROCESSED', 'ERROR')),
    ready_to_create_sap_oa BOOLEAN DEFAULT FALSE,
    ready_to_update_sap_oa BOOLEAN DEFAULT FALSE,
    finished_update_sap_oa BOOLEAN DEFAULT FALSE,
    sap_oa_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_header_status
    ON contract_header_staging (status);

CREATE INDEX IF NOT EXISTS idx_contract_header_ready_create
    ON contract_header_staging (ready_to_create_sap_oa);

CREATE INDEX IF NOT EXISTS idx_contract_header_ready_update
    ON contract_header_staging (ready_to_update_sap_oa);

CREATE TABLE IF NOT EXISTS supplier_item_staging (
    id SERIAL PRIMARY KEY,
    contract_id VARCHAR(100) NOT NULL,
    csin VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'NEW' CHECK (status IN ('NEW', 'PROCESSED', 'ERROR')),
    sap_oa_number VARCHAR(100),
    sap_oa_line VARCHAR(100),
    finished_update_sap_oa BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (contract_id, csin)
);

CREATE INDEX IF NOT EXISTS idx_supplier_item_contract
    ON supplier_item_staging (contract_id);

CREATE INDEX IF NOT EXISTS idx_supplier_item_status
    ON supplier_item_staging (status);


