const axios = require('axios');
const https = require('https');
const { URL } = require('url');
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
    
    // Initialize axios instance - we'll handle serialization in the put method
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Don't set transformRequest at instance level - handle it per-request
    });

    // Set up request interceptor to add authentication and ensure headers match example
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // CRITICAL: Log the exact data being sent for PUT requests to /api/contracts
        if (config.method === 'put' && config.url && config.url.includes('/api/contracts')) {
          logger.info(`REQUEST INTERCEPTOR - PUT to /api/contracts:`, {
            dataType: typeof config.data,
            isString: typeof config.data === 'string',
            isBuffer: Buffer.isBuffer(config.data),
            dataPreview: typeof config.data === 'string' ? config.data.substring(0, 200) : String(config.data).substring(0, 200),
            hasStringId: typeof config.data === 'string' ? config.data.includes('"id":"') : false,
          });
          
          // If data is a string (JSON string), check and fix it
          if (typeof config.data === 'string') {
            // Check if id is a string in the JSON
            if (config.data.includes('"id":"')) {
              logger.error(`CRITICAL: Request interceptor sees id as string! Fixing... Raw: ${config.data}`);
              // Fix it with regex
              config.data = config.data.replace(/"id":"(\d+)"/g, '"id":$1');
              logger.info(`Request interceptor fixed to: ${config.data}`);
              
              // Verify the fix
              try {
                const verify = JSON.parse(config.data);
                if (typeof verify.id !== 'number') {
                  logger.error(`CRITICAL: After regex fix in interceptor, id is still ${typeof verify.id}!`);
                  verify.id = parseInt(String(verify.id), 10);
                  config.data = JSON.stringify(verify);
                  logger.info(`Request interceptor forced fix: ${config.data}`);
                }
              } catch (e) {
                logger.error(`Error parsing data in interceptor: ${e.message}`);
              }
            }
          } 
          // If data is an object, ensure id is a number
          else if (config.data && typeof config.data === 'object' && !Buffer.isBuffer(config.data)) {
            if ('id' in config.data && typeof config.data.id !== 'number') {
              logger.error(`CRITICAL: Request interceptor sees id as ${typeof config.data.id}! Fixing...`);
              config.data.id = parseInt(String(config.data.id), 10);
              if (isNaN(config.data.id)) {
                throw new Error(`Invalid id value: ${config.data.id}`);
              }
              logger.info(`Request interceptor fixed object id to: ${config.data.id} (type: ${typeof config.data.id})`);
            }
          }
        }
        
        // Force Accept header to be exactly 'application/json' (override axios defaults)
        // Axios may add default Accept header, so we need to explicitly override it
        if (config.headers) {
          // Remove any default Accept headers (case-insensitive)
          const headerKeys = Object.keys(config.headers);
          headerKeys.forEach(key => {
            if (key.toLowerCase() === 'accept') {
              delete config.headers[key];
            }
          });
          
          // Set the exact headers we want (matching the example)
          // Use Object.defineProperty to ensure it can't be overridden
          Object.defineProperty(config.headers, 'Accept', {
            value: 'application/json',
            writable: true,
            enumerable: true,
            configurable: true,
          });
          config.headers['Content-Type'] = 'application/json';
        }
        
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
      // Ensure data is properly formatted - convert id to number if it exists
      // Create a completely new object to avoid any reference issues
      let formattedData;
      
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Convert id to number if it exists
        let idNum = null;
        if ('id' in data) {
          if (typeof data.id === 'number') {
            idNum = data.id;
          } else if (typeof data.id === 'string') {
            idNum = Number(data.id);
          } else {
            idNum = Number(String(data.id));
          }
          
          if (isNaN(idNum) || !isFinite(idNum)) {
            throw new Error(`Invalid contract ID: ${data.id} (cannot convert to number)`);
          }
          
          // Ensure it's definitely a number (not a string representation)
          idNum = Number(idNum);
        }
        
        // Create a completely fresh object with all properties
        formattedData = {};
        for (const key in data) {
          if (key === 'id') {
            // Explicitly set id as a number
            formattedData.id = idNum;
          } else {
            // Copy other properties as-is
            formattedData[key] = data[key];
          }
        }
        
        // If id was in the original data, ensure it's set as a number
        if ('id' in data && idNum !== null) {
          formattedData.id = idNum;
        }
      } else {
        formattedData = data;
      }
      
      // Final verification - ensure id is a number
      if (formattedData && typeof formattedData === 'object' && 'id' in formattedData) {
        if (typeof formattedData.id !== 'number') {
          logger.error(`ERROR: Formatted data id is not a number!`, {
            originalData: data,
            formattedData: formattedData,
            idType: typeof formattedData.id,
            idValue: formattedData.id,
          });
          throw new Error(`Contract ID must be a number, got ${typeof formattedData.id}: ${formattedData.id}`);
        }
      }
      
      // Verify JSON serialization maintains number type BEFORE sending
      const testJson = JSON.stringify(formattedData);
      const testParsed = JSON.parse(testJson);
      if (formattedData.id !== undefined && typeof testParsed.id !== 'number') {
        logger.error(`ERROR: JSON serialization converted id to ${typeof testParsed.id}!`, {
          original: formattedData,
          originalIdType: typeof formattedData.id,
          originalIdValue: formattedData.id,
          jsonString: testJson,
          parsed: testParsed,
          parsedIdType: typeof testParsed.id,
          parsedIdValue: testParsed.id,
        });
        // Force fix it by creating a new object with explicit number
        formattedData = {
          ...formattedData,
          id: Number(formattedData.id),
        };
      }
      
      // Manually serialize JSON string to ensure id is definitely a number
      // This bypasses axios's automatic serialization which might convert it to string
      let jsonPayload;
      if (formattedData && typeof formattedData === 'object') {
        // Create a completely fresh object with id as explicit number
        const finalData = {};
        for (const key in formattedData) {
          if (key === 'id' && formattedData[key] !== undefined) {
            // Force id to be a number - use parseInt to ensure it's an integer
            finalData[key] = parseInt(String(formattedData[key]), 10);
            if (isNaN(finalData[key])) {
              throw new Error(`Invalid contract ID: ${formattedData[key]}`);
            }
          } else {
            finalData[key] = formattedData[key];
          }
        }
        // Serialize to JSON string using replacer to FORCE id to be a number
        jsonPayload = JSON.stringify(finalData, (key, value) => {
          if (key === 'id' && value !== undefined && value !== null) {
            // Force id to be a number - parse and return as number
            const numValue = parseInt(String(value), 10);
            if (!isNaN(numValue) && isFinite(numValue)) {
              return numValue; // Return as number type
            }
            throw new Error(`Invalid id value: ${value}`);
          }
          return value; // Return other values as-is
        });
        
        // Final verification - parse it back and check
        const verify = JSON.parse(jsonPayload);
        if (verify.id !== undefined && typeof verify.id !== 'number') {
          logger.error(`CRITICAL: JSON still has id as ${typeof verify.id} after replacer!`, {
            jsonPayload,
            verify,
            verifyIdType: typeof verify.id,
            verifyIdValue: verify.id,
            finalDataIdType: typeof finalData.id,
            finalDataIdValue: finalData.id,
          });
          // Force fix by manually constructing the JSON string with id as number
          const fixedData = { ...verify };
          fixedData.id = parseInt(String(verify.id), 10);
          jsonPayload = JSON.stringify(fixedData);
        }
      } else {
        jsonPayload = JSON.stringify(formattedData);
      }
      
      // Log request details for debugging
      logger.debug(`Coupa PUT request:`, {
        endpoint,
        url: `${this.baseURL}${endpoint}`,
        originalData: JSON.stringify(data),
        formattedData: JSON.stringify(formattedData),
        jsonPayload: jsonPayload,
        idType: typeof formattedData?.id,
        idValue: formattedData?.id,
        parsedPayload: JSON.parse(jsonPayload),
        parsedIdType: typeof JSON.parse(jsonPayload)?.id,
      });
      
      // Final check: Verify the JSON string itself has id as number (not string)
      // Check the raw JSON string for "id":"232" vs "id":232
      if (jsonPayload.includes('"id":"')) {
        logger.error(`CRITICAL: JSON string has id as string! Raw JSON: ${jsonPayload}`);
        // Manually fix the JSON string by replacing "id":"232" with "id":232
        jsonPayload = jsonPayload.replace(/"id":"(\d+)"/g, '"id":$1');
        logger.info(`Fixed JSON string: ${jsonPayload}`);
      }
      
      // Verify one more time after regex fix
      const finalCheck = JSON.parse(jsonPayload);
      if (typeof finalCheck.id !== 'number') {
        logger.error(`CRITICAL: After all fixes, id is still ${typeof finalCheck.id}!`, {
          jsonPayload,
          finalCheck,
          finalCheckIdType: typeof finalCheck.id,
        });
        // Last resort: manually construct the JSON string
        finalCheck.id = parseInt(String(finalCheck.id), 10);
        jsonPayload = JSON.stringify(finalCheck);
        logger.info(`Final manual fix applied: ${jsonPayload}`);
      }
      
      // Final verification of JSON string - ensure id is a number
      if (jsonPayload.includes('"id":"')) {
        logger.error(`CRITICAL: Final check - JSON string still has id as string! Fixing...`);
        jsonPayload = jsonPayload.replace(/"id":"(\d+)"/g, '"id":$1');
        logger.info(`Final fix applied: ${jsonPayload}`);
        
        // Verify the fix worked
        const verify = JSON.parse(jsonPayload);
        if (typeof verify.id !== 'number') {
          logger.error(`CRITICAL: After regex fix, id is still ${typeof verify.id}! Forcing fix...`);
          verify.id = parseInt(String(verify.id), 10);
          jsonPayload = JSON.stringify(verify);
          logger.info(`Forced fix applied: ${jsonPayload}`);
        }
      }
      
      // Log the exact payload we're about to send
      logger.info(`FINAL PAYLOAD TO SEND:`, {
        jsonPayload,
        parsed: JSON.parse(jsonPayload),
        idType: typeof JSON.parse(jsonPayload).id,
        idValue: JSON.parse(jsonPayload).id,
        hasStringId: jsonPayload.includes('"id":"'),
      });
      
      // Use native https module to send request directly - bypass axios completely
      // This gives us 100% control over the exact bytes sent
      const https = require('https');
      const url = new URL(endpoint, this.baseURL);
      
      // Get the token
      let token = '';
      if (this.useOAuth2) {
        const CoupaTokenService = require('../services/coupa/coupaTokenService');
        token = `Bearer ${await CoupaTokenService.getAccessToken()}`;
      } else if (this.apiKey) {
        // For API key, we'd need to set a custom header
        throw new Error('API key authentication not supported with native https module');
      }
      
      // Final verification - ensure id is a number in the JSON string
      if (jsonPayload.includes('"id":"')) {
        logger.error(`CRITICAL: Final check - JSON string still has id as string! Fixing...`);
        jsonPayload = jsonPayload.replace(/"id":"(\d+)"/g, '"id":$1');
        logger.info(`Final fix applied: ${jsonPayload}`);
      }
      
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': token,
          'Content-Length': Buffer.byteLength(jsonPayload),
        },
      };
      
      logger.info(`Sending PUT request via native https:`, {
        url: url.toString(),
        jsonPayload,
        idInPayload: JSON.parse(jsonPayload).id,
        idType: typeof JSON.parse(jsonPayload).id,
      });
      
      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = responseData ? JSON.parse(responseData) : {};
                logger.info(`Coupa PUT successful:`, {
                  status: res.statusCode,
                  response: parsed,
                });
                resolve(parsed);
              } catch (e) {
                logger.warn(`Could not parse Coupa response as JSON: ${responseData}`);
                resolve(responseData);
              }
            } else {
              const error = new Error(`Request failed with status code ${res.statusCode}`);
              error.status = res.statusCode;
              error.statusText = res.statusMessage;
              error.responseData = responseData;
              logger.error(`Coupa PUT failed:`, {
                status: res.statusCode,
                statusText: res.statusMessage,
                responseData: responseData.substring(0, 500),
                requestPayload: jsonPayload,
              });
              reject(error);
            }
          });
        });
        
        req.on('error', (error) => {
          logger.error(`Native https request error:`, error);
          reject(error);
        });
        
        // Write the JSON payload directly - this is the exact bytes sent
        req.write(jsonPayload);
        req.end();
      });
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
        requestHeaders: error.config?.headers,
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

