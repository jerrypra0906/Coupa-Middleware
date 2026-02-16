const winston = require('winston');
require('dotenv').config();

const logLevel = process.env.LOG_LEVEL || 'info';

// Custom timestamp formatter for Jakarta timezone (UTC+7)
const jakartaTime = winston.format((info) => {
  const now = new Date();
  // Convert to Jakarta time (UTC+7)
  const jakartaOffset = 7 * 60; // 7 hours in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const jakartaTime = new Date(utc + (jakartaOffset * 60000));
  
  // Format: YYYY-MM-DD HH:mm:ss
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  const hours = String(jakartaTime.getHours()).padStart(2, '0');
  const minutes = String(jakartaTime.getMinutes()).padStart(2, '0');
  const seconds = String(jakartaTime.getSeconds()).padStart(2, '0');
  
  info.timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  return info;
})();

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    jakartaTime,
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'coupa-middleware' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Always add console transport for Docker visibility
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      // Safely stringify meta, handling circular references
      let metaStr = '';
      if (Object.keys(meta).length) {
        try {
          metaStr = JSON.stringify(meta);
        } catch (e) {
          // If circular reference, extract only safe properties
          const safeMeta = {};
          for (const [key, value] of Object.entries(meta)) {
            if (typeof value === 'object' && value !== null) {
              try {
                JSON.stringify(value);
                safeMeta[key] = value;
              } catch (e2) {
                safeMeta[key] = String(value);
              }
            } else {
              safeMeta[key] = value;
            }
          }
          metaStr = JSON.stringify(safeMeta);
        }
      }
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  )
}));

module.exports = logger;

