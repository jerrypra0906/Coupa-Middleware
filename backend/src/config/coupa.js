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
const CoupaTokenService = require('../services/coupa/coupaTokenService');

class CoupaClient {
  constructor() {
    // Determine base URL - prefer OAuth base URL if provided, otherwise use API base URL
    this.baseURL = process.env.COUPA_OAUTH_API_BASE_URL || process.env.COUPA_API_BASE_URL || 'https://api.coupa.com';
    this.apiKey = process.env.COUPA_API_KEY;
    this.companyId = process.env.COUPA_COMPANY_ID;
    
    // Determine authentication method - OAuth2 takes precedence if credentials are provided
    this.useOAuth2 = !!(process.env.COUPA_OAUTH_CLIENT_ID && process.env.COUPA_OAUTH_CLIENT_SECRET);
    
    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Set up request interceptor to add authentication and ensure headers match example
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Ensure Accept header is exactly 'application/json' (not axios default)
        config.headers['Accept'] = 'application/json';
        config.headers['Content-Type'] = 'application/json';
        
        if (this.useOAuth2) {
          // Use OAuth2 Bearer token
          const token = await CoupaTokenService.getAccessToken();
          config.headers['Authorization'] = `Bearer ${token}`;
        } else if (this.apiKey) {
          // Use API key (legacy)
          config.headers['X-COUPA-API-KEY'] = this.apiKey;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Set up response interceptor to handle 401 errors (token expired)
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If we get a 401 and we're using OAuth2, try to refresh the token
        if (error.response?.status === 401 && this.useOAuth2 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Clear the token and get a new one
            CoupaTokenService.clearToken();
            const token = await CoupaTokenService.getAccessToken();
            
            // Retry the original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return this.axiosInstance(originalRequest);
          } catch (tokenError) {
            logger.error('Failed to refresh token after 401 error:', tokenError);
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async postExchangeRates(data, options = {}) {
    const RetryHandler = require('../utils/retryHandler');
    const RateLimiter = require('../utils/rateLimiter');
    
    // Create rate limiter instance (100 requests per minute)
    const rateLimiter = new RateLimiter({
      maxRequests: options.maxRequestsPerMinute || 100,
      windowMs: 60000
    });
    
    const url = '/api/exchange_rates';
    
    // Batch processing for large datasets
    const batchSize = options.batchSize || 100;
    const batches = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        // Wait for rate limit if needed
        await rateLimiter.waitIfNeeded();
        
        const result = await RetryHandler.executeWithRetry(async () => {
          try {
            const response = await this.axiosInstance.post(url, batch, {
              timeout: options.timeout || 30000,
            });
            return response.data;
          } catch (error) {
            if (error.response) {
              logger.error(`Coupa API error (${error.response.status}):`, {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
                batchSize: batch.length,
                batchIndex: i + 1
              });
              
              // If rate limited, get retry-after delay
              if (RetryHandler.isRateLimitError(error)) {
                const retryAfter = RetryHandler.getRetryAfterDelay(error);
                if (retryAfter) {
                  await RetryHandler.sleep(retryAfter);
                }
              }
            } else if (error.request) {
              logger.error('Coupa API request failed - no response:', {
                message: error.message,
                code: error.code,
                batchSize: batch.length
              });
            } else {
              logger.error('Coupa API error:', error.message);
            }
            throw error;
          }
        }, {
          maxRetries: options.maxRetries || 3,
          initialDelay: options.initialDelay || 2000,
        });
        
        results.push({ batch: i + 1, data: result, success: true });
        logger.info(`Successfully posted batch ${i + 1}/${batches.length} (${batch.length} records)`);
      } catch (error) {
        errors.push({
          batch: i + 1,
          batchData: batch,
          error: error.message,
          status: error.response?.status,
          responseData: error.response?.data
        });
        logger.error(`Failed to post batch ${i + 1}/${batches.length}:`, error.message);
      }
    }
    
    if (errors.length > 0) {
      const error = new Error(`Failed to post ${errors.length} out of ${batches.length} batches`);
      error.batchErrors = errors;
      error.successfulBatches = results.length;
      throw error;
    }
    
    return results;
  }

  async get(endpoint) {
    try {
      const response = await this.axiosInstance.get(endpoint);
      return response.data;
    } catch (error) {
      logger.error(`Error getting data from Coupa ${endpoint}:`, error);
      throw error;
    }
  }

  async post(endpoint, data) {
    try {
      const response = await this.axiosInstance.post(endpoint, data);
      return response.data;
    } catch (error) {
      logger.error(`Error posting data to Coupa ${endpoint}:`, error);
      throw error;
    }
  }

  async put(endpoint, data) {
    try {
      // Log request details for debugging
      logger.debug(`Coupa PUT request:`, {
        endpoint,
        url: `${this.baseURL}${endpoint}`,
        data: JSON.stringify(data),
      });
      
      const response = await this.axiosInstance.put(endpoint, data);
      
      // Log successful response
      logger.debug(`Coupa PUT response:`, {
        endpoint,
        status: response.status,
        statusText: response.statusText,
      });
      
      return response.data;
    } catch (error) {
      // Enhanced error logging
      const errorDetails = {
        endpoint,
        url: `${this.baseURL}${endpoint}`,
        method: 'PUT',
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseHeaders: error.response?.headers,
        responseData: error.response?.data,
        requestData: data,
      };
      
      // If response is HTML (like the 500 error page), log it
      if (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
        logger.error(`Coupa API returned HTML error page for ${endpoint}:`, {
          ...errorDetails,
          responsePreview: error.response.data.substring(0, 500),
        });
      } else {
        logger.error(`Error putting data to Coupa ${endpoint}:`, errorDetails);
      }
      
      throw error;
    }
  }
}

module.exports = new CoupaClient();

