-- Seed default integration configuration for contracts / outline agreements
INSERT INTO integration_configuration (
  module_name,
  execution_interval,
  integration_mode,
  is_active,
  sap_endpoint,
  coupa_endpoint,
  retry_mode,
  config_json,
  created_at,
  updated_at
)
VALUES (
  'contracts',
  'every 15 minutes',
  'API',
  true,
  NULL,
  '/api/contracts',
  'MANUAL',
  jsonb_build_object(
    'description', 'Coupa Contract ↔ SAP OA sync',
    'delivery', 'API'
  ),
  NOW(),
  NOW()
)
ON CONFLICT (module_name) DO UPDATE SET
  execution_interval = EXCLUDED.execution_interval,
  integration_mode = EXCLUDED.integration_mode,
  is_active = EXCLUDED.is_active,
  sap_endpoint = EXCLUDED.sap_endpoint,
  coupa_endpoint = EXCLUDED.coupa_endpoint,
  retry_mode = EXCLUDED.retry_mode,
  config_json = EXCLUDED.config_json,
  updated_at = NOW();


