/**
 * Test script for Coupa OAuth2 token service
 * Run with: node src/scripts/testCoupaOAuth.js
 */

// Load .env.staging if NODE_ENV is staging, otherwise load .env
// In Docker, environment variables are already set, so dotenv won't override them
const path = require('path');
const fs = require('fs');
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const CoupaTokenService = require('../services/coupa/coupaTokenService');
const logger = require('../config/logger');

async function testOAuthToken() {
  try {
    console.log('Testing Coupa OAuth2 token service...');
    console.log('Token URL:', process.env.COUPA_OAUTH_TOKEN_URL);
    console.log('Client ID:', process.env.COUPA_OAUTH_CLIENT_ID ? '***' + process.env.COUPA_OAUTH_CLIENT_ID.slice(-4) : 'NOT SET');
    console.log('Client Secret:', process.env.COUPA_OAUTH_CLIENT_SECRET ? '***SET***' : 'NOT SET');
    console.log('');

    const token = await CoupaTokenService.getAccessToken();
    console.log('✅ Successfully obtained access token!');
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
    console.log('Token expires at:', new Date(CoupaTokenService.tokenExpiresAt).toISOString());
    
    // Test token reuse
    console.log('\nTesting token reuse...');
    const token2 = await CoupaTokenService.getAccessToken();
    console.log('✅ Token reused successfully (same token):', token === token2);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to obtain token:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testOAuthToken();

