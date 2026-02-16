-- Add new integration configuration for supplieritem-to-coupa
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
  'supplieritem-to-coupa',
  'every 15 minutes',
  'API',
  false,
  NULL,
  '/api/supplier_items',
  'MANUAL',
  jsonb_build_object(
    'description', 'Supplier Item to Coupa sync',
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

