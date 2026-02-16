-- Align contract_header_staging with Contract Header Mapping.xlsx
-- Adds Middleware-Field Name columns with appropriate types.

ALTER TABLE contract_header_staging
    ADD COLUMN IF NOT EXISTS ebeln VARCHAR(255),          -- SAP OA#
    ADD COLUMN IF NOT EXISTS ctr_name VARCHAR(255),       -- Coupa Contract Name
    ADD COLUMN IF NOT EXISTS ctr_num VARCHAR(255),        -- Contract #
    ADD COLUMN IF NOT EXISTS ctr_id INTEGER,              -- Contract ID
    ADD COLUMN IF NOT EXISTS ctr_type VARCHAR(10),        -- Contract Type
    ADD COLUMN IF NOT EXISTS ctr_stat VARCHAR(20),        -- Status
    ADD COLUMN IF NOT EXISTS own_login VARCHAR(50),       -- Owner Login
    ADD COLUMN IF NOT EXISTS comm_name VARCHAR(50),       -- Commodity Name
    ADD COLUMN IF NOT EXISTS ctr_cdat DATE,               -- Created Date
    ADD COLUMN IF NOT EXISTS lifnr INTEGER,               -- Supplier Site Number
    ADD COLUMN IF NOT EXISTS lfa1_name1 VARCHAR(255),     -- Supplier Name
    ADD COLUMN IF NOT EXISTS ekgrp VARCHAR(100),          -- Purchasing Group
    ADD COLUMN IF NOT EXISTS kdatb DATE,                  -- Starts
    ADD COLUMN IF NOT EXISTS ekorg VARCHAR(255),          -- Content Groups
    ADD COLUMN IF NOT EXISTS kdate DATE,                  -- Expires
    ADD COLUMN IF NOT EXISTS ctr_clog INTEGER,            -- Created By Login
    ADD COLUMN IF NOT EXISTS waers VARCHAR(3),            -- Currency Code
    ADD COLUMN IF NOT EXISTS zterm VARCHAR(4),            -- Payment Term
    ADD COLUMN IF NOT EXISTS inco1 VARCHAR(3),            -- Shipping Term
    ADD COLUMN IF NOT EXISTS ktwrt INTEGER,               -- Maximum Spend
    ADD COLUMN IF NOT EXISTS ctr_updt DATE,               -- Updated Date
    ADD COLUMN IF NOT EXISTS ekpo_pstyp VARCHAR(10),      -- Item Category
    ADD COLUMN IF NOT EXISTS bukrs VARCHAR(50),           -- Company Code
    ADD COLUMN IF NOT EXISTS crt_sapoa VARCHAR(10),       -- Ready to Create SAP OA
    ADD COLUMN IF NOT EXISTS upd_sapoa VARCHAR(10),       -- Ready to Update SAP OA
    ADD COLUMN IF NOT EXISTS amd_ctr_ty VARCHAR(10),      -- Amendment Contract Type
    ADD COLUMN IF NOT EXISTS ctrpa_id INTEGER,            -- Parent Contract ID
    ADD COLUMN IF NOT EXISTS ctrpa_name VARCHAR(255),     -- Parent Contract Name
    ADD COLUMN IF NOT EXISTS ctrpa_num VARCHAR(255);      -- Parent Contract Number


