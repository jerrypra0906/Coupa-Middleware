const pool = require('../config/database');

async function insertSampleExchangeRate() {
  try {
    // Sample exchange rate: USD to EUR
    const sampleRate = {
      from_currency: 'USD',
      to_currency: 'EUR',
      rate_value: 0.92500000, // Example rate
      rate_date: new Date().toISOString().split('T')[0], // Today's date
      status: 'NEW'
    };

    const query = `
      INSERT INTO exchange_rate_staging 
      (from_currency, to_currency, rate_value, rate_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (from_currency, to_currency, rate_date)
      DO UPDATE SET 
        rate_value = EXCLUDED.rate_value,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await pool.query(query, [
      sampleRate.from_currency,
      sampleRate.to_currency,
      sampleRate.rate_value,
      sampleRate.rate_date,
      sampleRate.status
    ]);

    console.log('Sample exchange rate inserted successfully:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error inserting sample exchange rate:', error);
    process.exit(1);
  }
}

insertSampleExchangeRate();

