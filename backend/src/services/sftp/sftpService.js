const sftpConfig = require('../../config/sftp');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../config/logger');

class SFTPService {
  async uploadFile(localFilePath, remoteFilePath, options = {}) {
    const RetryHandler = require('../../utils/retryHandler');
    
    return await RetryHandler.executeWithRetry(async () => {
      try {
        logger.info(`Uploading file to SFTP: ${remoteFilePath}`);
        await sftpConfig.uploadFile(localFilePath, remoteFilePath);
        logger.info(`File uploaded successfully: ${remoteFilePath}`);
        return true;
      } catch (error) {
        logger.error('Error uploading file to SFTP:', {
          remotePath: remoteFilePath,
          error: error.message,
          code: error.code,
        });
        throw error;
      }
    }, {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 2000,
      shouldRetry: (error) => {
        return error.code === 'ECONNREFUSED' || 
               error.code === 'ETIMEDOUT' || 
               error.code === 'ENOTFOUND' ||
               error.message?.includes('connection') ||
               error.message?.includes('timeout') ||
               error.message?.includes('authentication');
      }
    });
  }

  async downloadFile(remoteFilePath, localFilePath) {
    try {
      logger.info(`Downloading file from SFTP: ${remoteFilePath}`);
      await sftpConfig.downloadFile(remoteFilePath, localFilePath);
      logger.info(`File downloaded successfully: ${localFilePath}`);
      return true;
    } catch (error) {
      logger.error('Error downloading file from SFTP:', error);
      throw error;
    }
  }

  async listFiles(remotePath) {
    try {
      const files = await sftpConfig.listFiles(remotePath);
      return files;
    } catch (error) {
      logger.error('Error listing files from SFTP:', error);
      throw error;
    }
  }

  async uploadCSV(data, filename, folder = 'ExchangeRates', options = {}) {
    const RetryHandler = require('../../utils/retryHandler');
    
    return await RetryHandler.executeWithRetry(async () => {
      try {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, '../../../temp');
        await fs.mkdir(tempDir, { recursive: true });

        // Create local file path
        const localFilePath = path.join(tempDir, filename);

        // Write CSV data to local file
        await fs.writeFile(localFilePath, data, 'utf8');

        // Construct remote path
        // If folder starts with /, treat it as absolute path (relative to SFTP root)
        // Otherwise, append it to incomingPath
        let remotePath;
        if (folder.startsWith('/')) {
          // Absolute path from SFTP root
          remotePath = `${folder}/${filename}`.replace(/\/+/g, '/'); // Normalize slashes
        } else {
          // Relative to incomingPath
          remotePath = `${sftpConfig.incomingPath}/${folder}/${filename}`.replace(/\/+/g, '/'); // Normalize slashes
        }
        
        await this.uploadFile(localFilePath, remotePath);

        // Clean up local file
        await fs.unlink(localFilePath).catch(err => {
          logger.warn('Error deleting temp file:', err);
        });

        logger.info(`Successfully uploaded CSV to SFTP: ${remotePath}`);
        return remotePath;
      } catch (error) {
        logger.error('Error uploading CSV to SFTP:', {
          filename,
          folder,
          error: error.message,
          code: error.code,
        });
        throw error;
      }
    }, {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 2000,
      shouldRetry: (error) => {
        // Retry on connection errors, timeouts, and network issues
        return error.code === 'ECONNREFUSED' || 
               error.code === 'ETIMEDOUT' || 
               error.code === 'ENOTFOUND' ||
               error.message?.includes('connection') ||
               error.message?.includes('timeout');
      }
    });
  }

  async downloadCSV(remoteFilePath) {
    try {
      // Create temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../../../temp');
      await fs.mkdir(tempDir, { recursive: true });

      // Create local file path
      const filename = path.basename(remoteFilePath);
      const localFilePath = path.join(tempDir, `download_${Date.now()}_${filename}`);

      // Download from SFTP
      await this.downloadFile(remoteFilePath, localFilePath);

      // Read file content
      const content = await fs.readFile(localFilePath, 'utf8');

      // Clean up local file
      await fs.unlink(localFilePath).catch(err => {
        logger.warn('Error deleting temp file:', err);
      });

      return content;
    } catch (error) {
      logger.error('Error downloading CSV from SFTP:', error);
      throw error;
    }
  }

  async getNewFiles(folder, sinceDate = null) {
    try {
      let remotePath;
      if (!folder) {
        remotePath = sftpConfig.incomingPath;
      } else if (folder.startsWith('/')) {
        remotePath = folder;
      } else {
        remotePath = `${sftpConfig.incomingPath}/${folder}`;
      }
      logger.info(`Listing SFTP files from: ${remotePath}`);
      const files = await Promise.race([
        this.listFiles(remotePath),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SFTP listFiles timeout after 30 seconds')), 30000)
        )
      ]);

      if (!sinceDate) {
        return files.filter(file => file.type === '-'); // Only files, not directories
      }

      return files.filter(file => {
        if (file.type !== '-') return false;
        const fileDate = new Date(file.modifyTime);
        return fileDate >= sinceDate;
      });
    } catch (error) {
      logger.error('Error getting new files from SFTP:', error);
      throw error;
    }
  }

  async moveFile(remoteFilePath, destinationPath) {
    try {
      // Ensure destination directory exists
      // Use Unix-style path handling for SFTP
      const destinationDir = destinationPath.split('/').slice(0, -1).join('/') || '/';
      logger.info(`Ensuring archive directory exists: ${destinationDir}`);
      if (destinationDir && destinationDir !== '.' && destinationDir !== '/') {
        try {
          await sftpConfig.ensureDirectoryExists(destinationDir);
          logger.info(`Archive directory verified/created: ${destinationDir}`);
        } catch (dirError) {
          logger.error(`Failed to ensure directory exists ${destinationDir}: ${dirError.message}`);
          // Continue anyway - maybe the directory already exists or rename will create it
        }
      }

      // Try to use rename first (more efficient if source and destination are on same filesystem)
      try {
        await sftpConfig.renameFile(remoteFilePath, destinationPath);
        logger.info(`File moved (renamed) from ${remoteFilePath} to ${destinationPath}`);
        return true;
      } catch (renameError) {
        // If rename fails (e.g., cross-filesystem), fall back to copy + delete
        logger.info(`Rename failed, using copy+delete method: ${renameError.message}`);
        
        // Download file content
        const content = await this.downloadCSV(remoteFilePath);
        
        // Upload to destination
        const tempDir = path.join(__dirname, '../../../temp');
        const filename = path.basename(destinationPath);
        const localFilePath = path.join(tempDir, `move_${Date.now()}_${filename}`);
        await fs.writeFile(localFilePath, content, 'utf8');
        
        try {
          await this.uploadFile(localFilePath, destinationPath);
          logger.info(`File uploaded to destination: ${destinationPath}`);
        } catch (uploadError) {
          logger.error(`Failed to upload file to ${destinationPath}:`, uploadError);
          await fs.unlink(localFilePath).catch(() => {});
          throw uploadError;
        }
        
        await fs.unlink(localFilePath).catch(() => {});
        
        // Delete original file
        try {
          await sftpConfig.deleteFile(remoteFilePath);
          logger.info(`Original file deleted: ${remoteFilePath}`);
        } catch (deleteError) {
          logger.error(`Failed to delete original file ${remoteFilePath}:`, deleteError);
          // Don't throw - file was copied successfully, deletion failure is less critical
        }
        
        logger.info(`File moved (copy+delete) from ${remoteFilePath} to ${destinationPath}`);
        return true;
      }
    } catch (error) {
      logger.error('Error moving file on SFTP:', error);
      throw error;
    }
  }
}

module.exports = new SFTPService();

