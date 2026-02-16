// Test CSV generation for exchange rates
const TransformationService = require('./src/services/transformation/transformationService');
const ExchangeRateStaging = require('./src/models/ExchangeRateStaging');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log(`Loaded environment from: ${envPath}`);
} else {
  require('dotenv').config();
  console.log('Loaded default .env file');
}

async function testCSVGeneration() {
  try {
    console.log('\n=== Testing CSV Generation ===\n');

    // 1. Fetch staging records
    console.log('1. Fetching exchange rate records from staging...');
    const stagingRecords = await ExchangeRateStaging.findByStatus('NEW');
    console.log(`   Found ${stagingRecords.length} records with status 'NEW'`);
    
    if (stagingRecords.length === 0) {
      console.log('\n   No records found. Creating a sample record for testing...');
      // Create a sample record
      const sampleRecord = await ExchangeRateStaging.create({
        from_currency: 'USD',
        to_currency: 'EUR',
        rate_value: 0.925,
        rate_date: '2025-12-10',
        status: 'NEW'
      });
      console.log('   Sample record created:', sampleRecord.id);
      
      // Fetch again
      const records = await ExchangeRateStaging.findByStatus('NEW');
      console.log(`   Now found ${records.length} records\n`);
      
      // Transform to the format needed for CSV
      const testRecords = records.map(record => ({
        id: record.id,
        from_currency: record.from_currency,
        to_currency: record.to_currency,
        rate_value: parseFloat(record.rate_value),
        rate_date: record.rate_date,
      }));
      
      // Generate CSV
      console.log('2. Generating CSV...');
      const csv = TransformationService.buildExchangeRateCSV(testRecords);
      
      console.log('\n=== Generated CSV Content ===\n');
      console.log(csv);
      console.log('\n=== End of CSV ===\n');
      
      // Show CSV statistics
      const lines = csv.split('\n').filter(line => line.trim());
      console.log('CSV Statistics:');
      console.log(`  Total lines: ${lines.length}`);
      console.log(`  Header line: ${lines[0]}`);
      console.log(`  Data lines: ${lines.length - 1}`);
      console.log(`  CSV length: ${csv.length} characters`);
      
      // Save to file for inspection
      const outputPath = path.join(__dirname, 'test-output.csv');
      fs.writeFileSync(outputPath, csv, 'utf8');
      console.log(`\n✓ CSV saved to: ${outputPath}`);
      
      // Show filename that would be generated
      console.log('\n=== CSV Filename Generation ===');
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
      const date = now.toISOString().split('T')[0].replace(/-/g, '');
      const datetime = now.toISOString().replace(/[-:T]/g, '').split('.')[0].replace(/(\d{8})(\d{6})/, '$1_$2');
      const moduleName = 'exchange-rate';
      
      const namingFormats = [
        'ExchangeRate_{timestamp}.csv',
        'ExchangeRate_{date}.csv',
        'ExchangeRate_{datetime}.csv',
        '{module}_{timestamp}.csv',
        'FxRates_{date}_{timestamp}.csv'
      ];
      
      console.log('Sample filenames with different formats:');
      namingFormats.forEach(format => {
        let filename = format
          .replace(/{timestamp}/g, timestamp)
          .replace(/{date}/g, date)
          .replace(/{datetime}/g, datetime)
          .replace(/{module}/g, moduleName);
        
        if (!filename.toLowerCase().endsWith('.csv')) {
          filename += '.csv';
        }
        
        console.log(`  Format: ${format}`);
        console.log(`  Result: ${filename}`);
        console.log('');
      });
      
      process.exit(0);
    } else {
      // Transform to the format needed for CSV
      const records = stagingRecords.map(record => ({
        id: record.id,
        from_currency: record.from_currency,
        to_currency: record.to_currency,
        rate_value: parseFloat(record.rate_value),
        rate_date: record.rate_date,
      }));
      
      console.log('\n   Records to process:');
      records.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec.from_currency} -> ${rec.to_currency}: ${rec.rate_value} (${rec.rate_date})`);
      });
      
      // Generate CSV
      console.log('\n2. Generating CSV...');
      const csv = TransformationService.buildExchangeRateCSV(records);
      
      console.log('\n=== Generated CSV Content ===\n');
      console.log(csv);
      console.log('\n=== End of CSV ===\n');
      
      // Show CSV statistics
      const lines = csv.split('\n').filter(line => line.trim());
      console.log('CSV Statistics:');
      console.log(`  Total lines: ${lines.length}`);
      console.log(`  Header line: ${lines[0]}`);
      console.log(`  Data lines: ${lines.length - 1}`);
      console.log(`  CSV length: ${csv.length} characters`);
      
      // Save to file for inspection
      const outputPath = path.join(__dirname, 'test-output.csv');
      fs.writeFileSync(outputPath, csv, 'utf8');
      console.log(`\n✓ CSV saved to: ${outputPath}`);
      
      // Show filename that would be generated
      console.log('\n=== CSV Filename Generation ===');
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
      const date = now.toISOString().split('T')[0].replace(/-/g, '');
      const datetime = now.toISOString().replace(/[-:T]/g, '').split('.')[0].replace(/(\d{8})(\d{6})/, '$1_$2');
      const moduleName = 'exchange-rate';
      
      const namingFormats = [
        'ExchangeRate_{timestamp}.csv',
        'ExchangeRate_{date}.csv',
        'ExchangeRate_{datetime}.csv',
        '{module}_{timestamp}.csv',
        'FxRates_{date}_{timestamp}.csv'
      ];
      
      console.log('Sample filenames with different formats:');
      namingFormats.forEach(format => {
        let filename = format
          .replace(/{timestamp}/g, timestamp)
          .replace(/{date}/g, date)
          .replace(/{datetime}/g, datetime)
          .replace(/{module}/g, moduleName);
        
        if (!filename.toLowerCase().endsWith('.csv')) {
          filename += '.csv';
        }
        
        console.log(`  Format: ${format}`);
        console.log(`  Result: ${filename}`);
        console.log('');
      });
      
      process.exit(0);
    }
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCSVGeneration();

