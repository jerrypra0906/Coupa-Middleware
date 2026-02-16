-- Add archive_path to contract header ingestion config
UPDATE integration_configuration
SET config_json = jsonb_set(
  COALESCE(config_json, '{}'::jsonb),
  '{archive_path}',
  '"/Archive/Outgoing/Contracts"'::jsonb
)
WHERE module_name = 'contracts-header-ingest';

-- Ensure the archive_path is set correctly
UPDATE integration_configuration
SET config_json = config_json || '{"archive_path": "/Archive/Outgoing/Contracts"}'::jsonb
WHERE module_name = 'contracts-header-ingest';

