-- Update SFTP folder path for contract header ingestion to absolute path
UPDATE integration_configuration
SET config_json = jsonb_build_object(
  'sftp_folder', '/Outgoing/Contract',
  'description', 'Contract Header CSV ingestion from Coupa sFTP'
)
WHERE module_name = 'contracts-header-ingest';


