-- Update SFTP folder path for supplier item ingestion to absolute path
UPDATE integration_configuration
SET config_json = jsonb_build_object(
  'sftp_folder', '/Outgoing/Supplier Items',
  'description', 'Supplier Item CSV ingestion from Coupa sFTP'
)
WHERE module_name = 'contracts-supplieritem-ingest';


