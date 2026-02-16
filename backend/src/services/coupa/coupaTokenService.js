const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Load .env.staging if NODE_ENV is staging, otherwise load .env
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, '../../../', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const logger = require('../../config/logger');

class CoupaTokenService {
  constructor() {
    this.tokenEndpoint = process.env.COUPA_OAUTH_TOKEN_URL || 'https://kpn-test.coupahost.com/oauth2/token';
    this.clientId = process.env.COUPA_OAUTH_CLIENT_ID;
    this.clientSecret = process.env.COUPA_OAUTH_CLIENT_SECRET;
    this.scope = process.env.COUPA_OAUTH_SCOPE || '';
    
    // Token cache
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.tokenRefreshPromise = null;
  }

  /**
   * Get a valid access token, refreshing if necessary
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    // If we have a valid token, return it
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      // Refresh 60 seconds before expiry
      return this.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Start a new token refresh
    this.tokenRefreshPromise = this._refreshToken();
    
    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Request a new access token from Coupa OAuth2 endpoint
   * @private
   * @returns {Promise<string>} Access token
   */
  async _refreshToken() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('COUPA_OAUTH_CLIENT_ID and COUPA_OAUTH_CLIENT_SECRET must be set');
    }

    try {
      logger.info('Requesting new Coupa OAuth2 access token...');

      // Create Basic Auth header (client_id:client_secret base64 encoded)
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      // Build token URL with client_id as query parameter
      const tokenUrl = `${this.tokenEndpoint}${this.tokenEndpoint.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(this.clientId)}`;

      // Prepare request body
      const requestBody = new URLSearchParams();
      requestBody.append('grant_type', 'client_credentials');
      if (this.scope) {
        requestBody.append('scope', this.scope);
      }

      const response = await axios.post(tokenUrl, requestBody.toString(), {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });

      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token response: missing access_token');
      }

      this.accessToken = response.data.access_token;
      
      // Calculate expiration time (default to 3600 seconds if not provided)
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = Date.now() + (expiresIn * 1000);

      logger.info(`Successfully obtained Coupa OAuth2 access token (expires in ${expiresIn}s)`);
      
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to obtain Coupa OAuth2 access token:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      
      // Clear cached token on error
      this.accessToken = null;
      this.tokenExpiresAt = null;
      
      throw new Error(`Failed to obtain Coupa OAuth2 token: ${error.message}`);
    }
  }

  /**
   * Clear the cached token (force refresh on next request)
   */
  clearToken() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.tokenRefreshPromise = null;
  }
}

module.exports = new CoupaTokenService();

