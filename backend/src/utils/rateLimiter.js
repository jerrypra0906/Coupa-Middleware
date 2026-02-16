const logger = require('../config/logger');

/**
 * Rate limiter utility to control API call frequency
 */
class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.requests = [];
  }

  /**
   * Check if request can be made, and record it
   * @returns {Promise} Resolves when request can be made
   */
  async waitIfNeeded() {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        logger.info(`Rate limit reached. Waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
        // Clean up again after waiting
        this.requests = this.requests.filter(timestamp => Date.now() - timestamp < this.windowMs);
      }
    }
    
    this.requests.push(Date.now());
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requests = [];
  }
}

module.exports = RateLimiter;

