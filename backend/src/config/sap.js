const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Load .env.staging if NODE_ENV is staging, otherwise load .env
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const logger = require('./logger');

class SAPClient {
  constructor() {
    this.baseURL = process.env.SAP_BASE_URL;
    this.client = process.env.SAP_CLIENT;
    this.username = process.env.SAP_USER;
    this.password = process.env.SAP_PASSWORD;
    this.language = process.env.SAP_LANGUAGE || 'EN';
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.username,
        password: this.password,
      },
    });
  }

  async getExchangeRates(endpoint = null, options = {}) {
    const RetryHandler = require('../utils/retryHandler');
    const url = endpoint || process.env.SAP_ODATA_ENDPOINT || '/sap/opu/odata/SAP/Z_EXCHRATES_SRV/ExchangeRateSet';
    
    return await RetryHandler.executeWithRetry(async () => {
      try {
        const response = await this.axiosInstance.get(url, {
          timeout: options.timeout || 30000,
          params: options.params || {},
        });
        
        // Handle OData response format
        if (response.data && response.data.d) {
          return response.data.d.results || response.data.d;
        }
        
        return response.data;
      } catch (error) {
        if (error.response) {
          logger.error(`SAP API error (${error.response.status}):`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: url
          });
        } else if (error.request) {
          logger.error('SAP API request failed - no response:', {
            message: error.message,
            code: error.code,
            url: url
          });
        } else {
          logger.error('SAP API error:', error.message);
        }
        throw error;
      }
    }, {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 2000,
    });
  }

  async callZProgram(programName, parameters = {}) {
    try {
      const url = `/sap/bc/rest/zprogram/${programName}`;
      const response = await this.axiosInstance.post(url, parameters);
      return response.data;
    } catch (error) {
      logger.error(`Error calling SAP Z-program ${programName}:`, error);
      throw error;
    }
  }

  async postData(endpoint, data) {
    try {
      const response = await this.axiosInstance.post(endpoint, data);
      return response.data;
    } catch (error) {
      logger.error('Error posting data to SAP:', error);
      throw error;
    }
  }
}

module.exports = new SAPClient();

