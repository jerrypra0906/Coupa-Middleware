-- Set archive_path to /Archive/Outgoing/Contracts for contract header ingestion
UPDATE integration_configuration
SET config_json = config_json || '{"archive_path": "/Archive/Outgoing/Contracts"}'::jsonb
WHERE module_name = 'contracts-header-ingest';

