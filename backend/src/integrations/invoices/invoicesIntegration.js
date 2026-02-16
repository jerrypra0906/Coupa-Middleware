/**
 * Placeholder for invoices integration.
 * Returns a structured "not implemented" response to keep scheduler stable.
 */
async function execute() {
  return {
    successCount: 0,
    errorCount: 1,
    totalRecords: 0,
    errors: [{
      line_number: null,
      field_name: 'SYSTEM',
      error_message: 'Invoices integration not implemented',
      raw_payload: {},
    }],
  };
}

module.exports = { execute };

