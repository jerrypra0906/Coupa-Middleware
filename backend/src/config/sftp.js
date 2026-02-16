const SftpClient = require('ssh2-sftp-client');
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

class SFTPConfig {
  constructor() {
    // Build authentication config
    const authConfig = {};
    
    // Password authentication
    if (process.env.SFTP_PASSWORD) {
      authConfig.password = process.env.SFTP_PASSWORD;
    }
    
    // Private key authentication (if provided)
    if (process.env.SFTP_PRIVATE_KEY) {
      authConfig.privateKey = process.env.SFTP_PRIVATE_KEY;
    }
    
    // Private key file path (if provided)
    if (process.env.SFTP_PRIVATE_KEY_PATH) {
      try {
        authConfig.privateKey = fs.readFileSync(process.env.SFTP_PRIVATE_KEY_PATH, 'utf8');
      } catch (error) {
        logger.warn('Failed to read private key file:', error.message);
      }
    }
    
    // Passphrase for private key (if provided)
    if (process.env.SFTP_PASSPHRASE) {
      authConfig.passphrase = process.env.SFTP_PASSPHRASE;
    }
    
    this.config = {
      host: process.env.SFTP_HOST,
      port: parseInt(process.env.SFTP_PORT) || 22,
      username: process.env.SFTP_USERNAME,
      ...authConfig,
      readyTimeout: parseInt(process.env.SFTP_READY_TIMEOUT) || 20000,
      // Try multiple authentication methods
      tryKeyboard: true,
      algorithms: {
        // Allow common algorithms
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519'],
        kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group14-sha256', 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group14-sha1'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm', 'aes256-gcm'],
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519'],
        hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1']
      }
    };
    this.incomingPath = process.env.SFTP_INCOMING_PATH || '/Incoming';
    this.outgoingPath = process.env.SFTP_OUTGOING_PATH || '/Outgoing';
    
    // Log SFTP configuration (without sensitive data)
    logger.info('SFTP Configuration loaded:', {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      incomingPath: this.incomingPath,
      outgoingPath: this.outgoingPath,
      passwordSet: !!this.config.password,
      privateKeySet: !!this.config.privateKey,
      passphraseSet: !!this.config.passphrase
    });
  }

  async connect() {
    const sftp = new SftpClient();
    try {
      logger.info(`Attempting SFTP connection to ${this.config.host}:${this.config.port}...`);
      await Promise.race([
        sftp.connect(this.config),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SFTP connection timeout after 30 seconds')), 30000)
        )
      ]);
      logger.info('SFTP connection established');
      return sftp;
    } catch (error) {
      logger.error('Error connecting to SFTP:', error);
      throw error;
    }
  }

  async uploadFile(localPath, remotePath) {
    const sftp = await this.connect();
    try {
      await sftp.put(localPath, remotePath);
      logger.info(`File uploaded to ${remotePath}`);
      return true;
    } catch (error) {
      logger.error('Error uploading file to SFTP:', error);
      throw error;
    } finally {
      await sftp.end();
    }
  }

  async downloadFile(remotePath, localPath) {
    const sftp = await this.connect();
    try {
      await sftp.get(remotePath, localPath);
      logger.info(`File downloaded from ${remotePath}`);
      return true;
    } catch (error) {
      logger.error('Error downloading file from SFTP:', error);
      throw error;
    } finally {
      await sftp.end();
    }
  }

  async listFiles(remotePath) {
    const sftp = await this.connect();
    try {
      const files = await sftp.list(remotePath);
      return files;
    } catch (error) {
      logger.error('Error listing files from SFTP:', error);
      throw error;
    } finally {
      await sftp.end();
    }
  }

  async deleteFile(remotePath) {
    const sftp = await this.connect();
    try {
      await sftp.delete(remotePath);
      logger.info(`File deleted from SFTP: ${remotePath}`);
      return true;
    } catch (error) {
      logger.error('Error deleting file from SFTP:', error);
      throw error;
    } finally {
      await sftp.end();
    }
  }

  async renameFile(oldPath, newPath) {
    const sftp = await this.connect();
    try {
      await sftp.rename(oldPath, newPath);
      logger.info(`File renamed on SFTP: ${oldPath} -> ${newPath}`);
      
      // Verify the file exists at destination
      try {
        const stats = await sftp.stat(newPath);
        if (stats.isFile) {
          logger.info(`Verified: File exists at destination ${newPath} (size: ${stats.size} bytes)`);
        } else {
          logger.warn(`Warning: Destination exists but is not a file: ${newPath}`);
        }
      } catch (verifyError) {
        logger.error(`Warning: Could not verify file at destination ${newPath}: ${verifyError.message}`);
      }
      
      return true;
    } catch (error) {
      logger.error('Error renaming file on SFTP:', error);
      throw error;
    } finally {
      await sftp.end();
    }
  }

  async ensureDirectoryExists(remotePath) {
    const sftp = await this.connect();
    try {
      // Check if directory exists
      try {
        const stats = await sftp.stat(remotePath);
        if (stats.isDirectory) {
          logger.info(`Directory already exists: ${remotePath}`);
          return true;
        } else {
          logger.warn(`Path exists but is not a directory: ${remotePath}`);
          throw new Error(`Path exists but is not a directory: ${remotePath}`);
        }
      } catch (statError) {
        if (statError.code === 2 || statError.message.includes('No such file')) {
          // Directory doesn't exist, create it
          logger.info(`Directory does not exist, creating: ${remotePath}`);
        } else {
          // Some other error
          throw statError;
        }
      }

      // Create directory (mkdir -p style, creates parent directories if needed)
      await sftp.mkdir(remotePath, true);
      logger.info(`Directory created: ${remotePath}`);
      
      // Verify it was created
      try {
        const stats = await sftp.stat(remotePath);
        if (stats.isDirectory) {
          logger.info(`Verified: Directory exists at ${remotePath}`);
        }
      } catch (verifyError) {
        logger.error(`Warning: Could not verify directory creation: ${verifyError.message}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error ensuring directory exists ${remotePath}:`, error);
      throw error;
    } finally {
      await sftp.end();
    }
  }
}

module.exports = new SFTPConfig();

