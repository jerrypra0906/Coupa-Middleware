-- Rename module from 'contracts' to 'contracts-header-to-coupa'
UPDATE integration_configuration
SET module_name = 'contracts-header-to-coupa'
WHERE module_name = 'contracts';

