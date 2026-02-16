-- Allow RUNNING status for integration_log
ALTER TABLE integration_log
  DROP CONSTRAINT IF EXISTS integration_log_status_check;

ALTER TABLE integration_log
  ADD CONSTRAINT integration_log_status_check
  CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL', 'RUNNING'));

