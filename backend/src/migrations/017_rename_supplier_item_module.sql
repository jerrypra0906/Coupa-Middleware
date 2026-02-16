-- Rename module from contracts-supplier-ingest to contracts-supplieritem-ingest
UPDATE integration_configuration
SET module_name = 'contracts-supplieritem-ingest'
WHERE module_name = 'contracts-supplier-ingest';

