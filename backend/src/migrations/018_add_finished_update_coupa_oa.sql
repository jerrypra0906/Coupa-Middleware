-- Add finished_update_coupa_oa field to contract_header_staging and supplier_item_staging

-- Add to contract_header_staging
ALTER TABLE contract_header_staging
ADD COLUMN IF NOT EXISTS finished_update_coupa_oa BOOLEAN DEFAULT FALSE;

-- Add to supplier_item_staging
ALTER TABLE supplier_item_staging
ADD COLUMN IF NOT EXISTS finished_update_coupa_oa BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN contract_header_staging.finished_update_coupa_oa IS 'Indicates if the contract header has been successfully updated in Coupa';
COMMENT ON COLUMN supplier_item_staging.finished_update_coupa_oa IS 'Indicates if the supplier item has been successfully updated in Coupa';

