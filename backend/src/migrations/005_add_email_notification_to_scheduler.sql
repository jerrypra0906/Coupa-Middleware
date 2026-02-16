-- Add email notification settings to integration_configuration table
ALTER TABLE integration_configuration 
ADD COLUMN IF NOT EXISTS email_notification_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_on_success BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_on_failure BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_on_partial BOOLEAN DEFAULT true;

-- Update existing records to have email_on_failure and email_on_partial enabled by default
UPDATE integration_configuration 
SET email_on_failure = true, email_on_partial = true 
WHERE email_on_failure IS NULL OR email_on_partial IS NULL;

