-- Seed default integration configuration for exchange-rate (CSV mode)
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
  'exchange-rate',
  'every 1 hour',
  'CSV',
  true,
  '/sap/opu/odata/SAP/Z_EXCHRATES_SRV/ExchangeRateSet',
  '/api/exchange_rates',
  'MANUAL',
  jsonb_build_object(
    'sftp_folder', 'ExchangeRates',
    'delivery', 'CSV'
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

