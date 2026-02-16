-- Align supplier_item_staging with Supplier Item Staging.xlsx

ALTER TABLE supplier_item_staging
    ADD COLUMN IF NOT EXISTS ctm_cnum VARCHAR(255),      -- Contract Number
    ADD COLUMN IF NOT EXISTS ebeln VARCHAR(10),          -- SAP Contract Number
    ADD COLUMN IF NOT EXISTS ebelp VARCHAR(10),          -- SAP Contract Line Number
    ADD COLUMN IF NOT EXISTS sap_oa_line VARCHAR(20),    -- SAP Contract No/Line No (SAP_OA_LINE)
    ADD COLUMN IF NOT EXISTS ctm_name VARCHAR(255),      -- Name
    ADD COLUMN IF NOT EXISTS ctm_plant VARCHAR(255),     -- Plant
    ADD COLUMN IF NOT EXISTS sup_apnm VARCHAR(255),      -- Supplier Aux Part Num
    ADD COLUMN IF NOT EXISTS ctm_desc VARCHAR(255),      -- Description
    ADD COLUMN IF NOT EXISTS ekpo_matnr VARCHAR(255),    -- Item Commodity Sap Code / Item Number
    ADD COLUMN IF NOT EXISTS ekpo_meins VARCHAR(50),     -- UOM Code
    ADD COLUMN IF NOT EXISTS ekpo_netpr NUMERIC(30,3),   -- Price
    ADD COLUMN IF NOT EXISTS price_per NUMERIC(30,3),    -- Price Per
    ADD COLUMN IF NOT EXISTS price_value NUMERIC(30,3),  -- Price Value
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3),        -- Currency (from header, optional copy)
    ADD COLUMN IF NOT EXISTS sup_qty INTEGER,            -- Supply Quantity
    ADD COLUMN IF NOT EXISTS ctm_avail VARCHAR(50),      -- Availability
    ADD COLUMN IF NOT EXISTS sup_moq INTEGER,            -- Supplier Minimum Order Quantity
    ADD COLUMN IF NOT EXISTS ctm_clog VARCHAR(255),      -- Created By (Login)
    ADD COLUMN IF NOT EXISTS ctm_ulog VARCHAR(255),      -- Updated By (Login)
    ADD COLUMN IF NOT EXISTS ctm_cdat DATE,              -- Created At
    ADD COLUMN IF NOT EXISTS ctm_udat DATE,              -- Updated At
    ADD COLUMN IF NOT EXISTS ctm_itxt VARCHAR(255),      -- CAT : Item Text / Item Commodity SAP Code
    ADD COLUMN IF NOT EXISTS ctm_inco VARCHAR(255),      -- Incoterm Location
    ADD COLUMN IF NOT EXISTS cin VARCHAR(20),            -- Coupa Internal Number
    ADD COLUMN IF NOT EXISTS csin VARCHAR(20),           -- Coupa Supplier Internal Number
    ADD COLUMN IF NOT EXISTS crt_sapoa VARCHAR(10),      -- Ready to Create SAP OA
    ADD COLUMN IF NOT EXISTS upd_sapoa VARCHAR(10);      -- Ready to Update SAP OA


