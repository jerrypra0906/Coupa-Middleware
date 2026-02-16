const logger = require('../config/logger');

/**
 * Batch processor utility for processing large datasets in chunks
 */
class BatchProcessor {
  /**
   * Process items in batches with optional concurrency control
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each batch
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Results with successes and errors
   */
  static async processBatches(items, processor, options = {}) {
    const {
      batchSize = 100,
      maxConcurrency = 1,
      onProgress = null,
    } = options;

    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push({
        index: Math.floor(i / batchSize) + 1,
        items: items.slice(i, i + batchSize),
        startIndex: i,
      });
    }

    const results = {
      successful: [],
      errors: [],
      totalBatches: batches.length,
      totalItems: items.length,
    };

    // Process batches with concurrency control
    const processBatch = async (batch) => {
      try {
        const result = await processor(batch.items, batch.index, batch.startIndex);
        results.successful.push({
          batch: batch.index,
          result,
        });
        
        if (onProgress) {
          onProgress({
            completed: results.successful.length + results.errors.length,
            total: batches.length,
            batch: batch.index,
            success: true,
          });
        }
        
        return { success: true, batch: batch.index };
      } catch (error) {
        results.errors.push({
          batch: batch.index,
          items: batch.items,
          error: error.message,
          details: error,
        });
        
        if (onProgress) {
          onProgress({
            completed: results.successful.length + results.errors.length,
            total: batches.length,
            batch: batch.index,
            success: false,
            error: error.message,
          });
        }
        
        logger.error(`Batch ${batch.index} failed:`, error.message);
        return { success: false, batch: batch.index, error };
      }
    };

    // Process with concurrency limit
    if (maxConcurrency === 1) {
      // Sequential processing
      for (const batch of batches) {
        await processBatch(batch);
      }
    } else {
      // Concurrent processing with limit
      const executing = [];
      for (const batch of batches) {
        const promise = processBatch(batch).then(() => {
          executing.splice(executing.indexOf(promise), 1);
        });
        executing.push(promise);

        if (executing.length >= maxConcurrency) {
          await Promise.race(executing);
        }
      }
      
      // Wait for remaining batches
      await Promise.all(executing);
    }

    return results;
  }

  /**
   * Process items one by one (for operations that can't be batched)
   */
  static async processItems(items, processor, options = {}) {
    const {
      onProgress = null,
      continueOnError = true,
    } = options;

    const results = {
      successful: [],
      errors: [],
      totalItems: items.length,
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await processor(items[i], i);
        results.successful.push({
          index: i,
          item: items[i],
          result,
        });
        
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: items.length,
            index: i,
            success: true,
          });
        }
      } catch (error) {
        results.errors.push({
          index: i,
          item: items[i],
          error: error.message,
          details: error,
        });
        
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: items.length,
            index: i,
            success: false,
            error: error.message,
          });
        }

        if (!continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }
}

module.exports = BatchProcessor;

