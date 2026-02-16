/**
 * Script to verify if data from dynamicexecution.id is real exchange data or dummy data
 * Compares with known exchange APIs to validate authenticity
 */

const axios = require('axios');
const https = require('https');

// Known reliable exchange rate APIs for comparison
const REFERENCE_APIS = {
  // Free tier APIs for currency exchange rates
  exchangerate_api: 'https://api.exchangerate-api.com/v4/latest/USD',
  fixer_io: 'https://api.fixer.io/latest?access_key=YOUR_KEY&base=USD', // Requires API key
  currencylayer: 'https://api.currencylayer.com/live?access_key=YOUR_KEY', // Requires API key
  
  // Cryptocurrency exchanges (if dynamicexecution.id shows crypto data)
  coinbase: 'https://api.coinbase.com/v2/exchange-rates?currency=USD',
  binance: 'https://api.binance.com/api/v3/ticker/price',
  coinmarketcap: 'https://api.coinmarketcap.com/v1/ticker/', // Deprecated but still works
};

/**
 * Fetch data from dynamicexecution.id
 */
async function fetchDynamicExecutionData() {
  try {
    console.log('Fetching data from dynamicexecution.id...');
    const response = await axios.get('https://dynamicexecution.id/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      // Allow self-signed certificates if needed
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    return {
      success: true,
      data: response.data,
      headers: response.headers,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      response: error.response?.data
    };
  }
}

/**
 * Extract exchange rate data from HTML (if it's embedded in the page)
 */
function extractExchangeDataFromHTML(html) {
  const results = {
    foundData: false,
    exchangeRates: [],
    cryptoPrices: [],
    rawData: null
  };
  
  try {
    // Look for JSON data in script tags
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (const script of scriptMatches) {
        // Try to find JSON data
        const jsonMatch = script.match(/\{[\s\S]*"rate"[\s\S]*\}|\{[\s\S]*"price"[\s\S]*\}/gi);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[0]);
            results.rawData = jsonData;
            results.foundData = true;
          } catch (e) {
            // Not valid JSON, continue
          }
        }
      }
    }
    
    // Look for data attributes
    const dataMatches = html.match(/data-[^=]*="[^"]*"/gi);
    if (dataMatches) {
      results.foundData = true;
    }
    
    // Look for table data with rates/prices
    const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
    if (tableMatches) {
      results.foundData = true;
    }
    
  } catch (error) {
    console.error('Error extracting data from HTML:', error.message);
  }
  
  return results;
}

/**
 * Compare with reference exchange APIs
 */
async function compareWithReferenceAPIs() {
  const comparisons = [];
  
  try {
    // Try Coinbase API (no key required)
    console.log('\nFetching reference data from Coinbase...');
    const coinbaseResponse = await axios.get(REFERENCE_APIS.coinbase, { timeout: 5000 });
    if (coinbaseResponse.data && coinbaseResponse.data.data) {
      comparisons.push({
        source: 'Coinbase',
        data: coinbaseResponse.data.data,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.log('Coinbase API unavailable:', error.message);
  }
  
  try {
    // Try ExchangeRate API (free, no key required)
    console.log('Fetching reference data from ExchangeRate-API...');
    const exchangeResponse = await axios.get(REFERENCE_APIS.exchangerate_api, { timeout: 5000 });
    if (exchangeResponse.data && exchangeResponse.data.rates) {
      comparisons.push({
        source: 'ExchangeRate-API',
        data: exchangeResponse.data.rates,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.log('ExchangeRate-API unavailable:', error.message);
  }
  
  return comparisons;
}

/**
 * Analyze if data appears to be real or dummy
 */
function analyzeData(htmlData, referenceData) {
  const analysis = {
    indicators: [],
    conclusion: 'UNKNOWN',
    confidence: 0
  };
  
  // Check 1: Does the data update in real-time?
  // (This would require multiple requests over time)
  
  // Check 2: Does the data match known exchange patterns?
  // (Compare with reference APIs)
  
  // Check 3: Are the values realistic?
  // (Check if rates are within reasonable ranges)
  
  // Check 4: Is there API documentation or data source disclosure?
  const hasDisclosure = htmlData.includes('data source') || 
                       htmlData.includes('API') || 
                       htmlData.includes('exchange') ||
                       htmlData.includes('real-time');
  
  if (hasDisclosure) {
    analysis.indicators.push('Website mentions data sources or APIs');
    analysis.confidence += 20;
  }
  
  // Check 5: Are timestamps present and recent?
  const hasTimestamps = htmlData.includes('timestamp') || 
                       htmlData.includes('updated') ||
                       htmlData.includes('last update');
  
  if (hasTimestamps) {
    analysis.indicators.push('Timestamps or update indicators found');
    analysis.confidence += 20;
  }
  
  // Check 6: Compare with reference data if available
  if (referenceData.length > 0) {
    analysis.indicators.push(`Compared with ${referenceData.length} reference API(s)`);
    analysis.confidence += 30;
  }
  
  // Check 7: Look for patterns that suggest dummy data
  const suspiciousPatterns = [
    /rate.*1\.00/i,  // Too many rates at exactly 1.00
    /price.*0\.00/i,  // Too many prices at 0.00
    /test.*data/i,    // Test data indicators
    /dummy.*data/i,   // Dummy data indicators
    /sample.*data/i   // Sample data indicators
  ];
  
  let suspiciousCount = 0;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(htmlData)) {
      suspiciousCount++;
    }
  }
  
  if (suspiciousCount > 0) {
    analysis.indicators.push(`Found ${suspiciousCount} suspicious pattern(s) suggesting dummy data`);
    analysis.confidence -= 30;
  }
  
  // Determine conclusion
  if (analysis.confidence >= 70) {
    analysis.conclusion = 'LIKELY_REAL';
  } else if (analysis.confidence <= 30) {
    analysis.conclusion = 'LIKELY_DUMMY';
  } else {
    analysis.conclusion = 'UNCERTAIN';
  }
  
  return analysis;
}

/**
 * Main verification function
 */
async function verifyExchangeData() {
  console.log('='.repeat(60));
  console.log('Exchange Data Verification Tool');
  console.log('Verifying: https://dynamicexecution.id/');
  console.log('='.repeat(60));
  
  // Step 1: Fetch data from dynamicexecution.id
  const dynamicData = await fetchDynamicExecutionData();
  
  if (!dynamicData.success) {
    console.error('\n❌ Failed to fetch data from dynamicexecution.id');
    console.error('Error:', dynamicData.error);
    console.error('Code:', dynamicData.code);
    return;
  }
  
  console.log('\n✅ Successfully fetched data from dynamicexecution.id');
  console.log('Status:', dynamicData.status);
  console.log('Content-Type:', dynamicData.headers['content-type']);
  console.log('Content Length:', dynamicData.data.length, 'bytes');
  
  // Step 2: Extract exchange data from HTML
  console.log('\n' + '-'.repeat(60));
  console.log('Extracting exchange data from HTML...');
  const extractedData = extractExchangeDataFromHTML(dynamicData.data);
  
  if (extractedData.foundData) {
    console.log('✅ Found potential exchange data in HTML');
    if (extractedData.rawData) {
      console.log('Raw JSON data:', JSON.stringify(extractedData.rawData, null, 2));
    }
  } else {
    console.log('⚠️  No obvious exchange data found in HTML structure');
    console.log('Note: Data might be loaded via JavaScript after page load');
  }
  
  // Step 3: Compare with reference APIs
  console.log('\n' + '-'.repeat(60));
  const referenceData = await compareWithReferenceAPIs();
  
  if (referenceData.length > 0) {
    console.log(`\n✅ Retrieved data from ${referenceData.length} reference API(s)`);
    referenceData.forEach(ref => {
      console.log(`\n${ref.source} data (sample):`);
      if (ref.data.rates) {
        const sampleRates = Object.entries(ref.data.rates).slice(0, 5);
        sampleRates.forEach(([currency, rate]) => {
          console.log(`  ${currency}: ${rate}`);
        });
      }
    });
  } else {
    console.log('\n⚠️  Could not fetch reference data for comparison');
  }
  
  // Step 4: Analyze the data
  console.log('\n' + '-'.repeat(60));
  console.log('Analyzing data authenticity...');
  const analysis = analyzeData(dynamicData.data, referenceData);
  
  console.log('\nAnalysis Results:');
  console.log('Indicators found:');
  analysis.indicators.forEach(indicator => {
    console.log(`  • ${indicator}`);
  });
  
  console.log(`\nConfidence Level: ${analysis.confidence}%`);
  console.log(`\nConclusion: ${analysis.conclusion}`);
  
  // Final recommendation
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(60));
  
  if (analysis.conclusion === 'LIKELY_DUMMY') {
    console.log('⚠️  WARNING: Data appears to be dummy/test data');
    console.log('   - Do not use for production purposes');
    console.log('   - Contact the website to verify data sources');
  } else if (analysis.conclusion === 'LIKELY_REAL') {
    console.log('✅ Data appears to be from real exchange sources');
    console.log('   - However, verify with website documentation');
    console.log('   - Check for API rate limits and terms of service');
  } else {
    console.log('❓ Unable to determine with certainty');
    console.log('   - Website may load data via JavaScript (not visible in HTML)');
    console.log('   - Check browser developer tools Network tab for API calls');
    console.log('   - Contact website support to verify data sources');
    console.log('   - Look for API documentation or data source disclosures');
  }
  
  console.log('\nTo get more accurate results:');
  console.log('1. Open https://dynamicexecution.id/ in a browser');
  console.log('2. Open Developer Tools (F12) → Network tab');
  console.log('3. Look for API calls that fetch exchange rate data');
  console.log('4. Check the API endpoints and verify their authenticity');
  console.log('5. Compare the data with known exchange APIs in real-time');
}

// Run the verification
if (require.main === module) {
  verifyExchangeData().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { verifyExchangeData };

