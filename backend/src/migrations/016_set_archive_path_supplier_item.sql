-- Set archive_path to /Archive/Outgoing/Supplier Items for supplier item ingestion
UPDATE integration_configuration
SET config_json = config_json || '{"archive_path": "/Archive/Outgoing/Supplier Items"}'::jsonb
WHERE module_name = 'contracts-supplieritem-ingest';

