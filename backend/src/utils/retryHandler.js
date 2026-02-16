const logger = require('../config/logger');

/**
 * Retry handler utility for API calls with exponential backoff
 */
class RetryHandler {
  /**
   * Execute a function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum number of retries (default: 3)
   * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
   * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
   * @param {Function} options.shouldRetry - Function to determine if error should be retried
   * @returns {Promise} Result of the function
   */
  static async executeWithRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      shouldRetry = (error) => {
        // Retry on network errors, timeouts, and 5xx errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          return true;
        }
        if (error.response) {
          const status = error.response.status;
          return status >= 500 || status === 429; // Server errors or rate limit
        }
        return false;
      }
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms. Error: ${error.message}`);
        
        await this.sleep(delay);
        delay = Math.min(delay * 2, maxDelay); // Exponential backoff
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a rate limit error (429)
   */
  static isRateLimitError(error) {
    return error.response && error.response.status === 429;
  }

  /**
   * Get retry-after delay from rate limit response
   */
  static getRetryAfterDelay(error) {
    if (this.isRateLimitError(error)) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000; // Convert to milliseconds
      }
    }
    return null;
  }
}

module.exports = RetryHandler;

