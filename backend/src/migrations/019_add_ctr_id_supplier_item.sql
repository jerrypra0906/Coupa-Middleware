-- Add CTR_ID field to supplier_item_staging table

ALTER TABLE supplier_item_staging
ADD COLUMN IF NOT EXISTS ctr_id INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN supplier_item_staging.ctr_id IS 'Contract ID - matches ctr_id in contract_header_staging';

