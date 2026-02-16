// Set timezone to Jakarta, Indonesia (Asia/Jakarta - UTC+7)
process.env.TZ = 'Asia/Jakarta';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Load .env.staging if NODE_ENV is staging, otherwise load .env
const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
const envPath = path.resolve(__dirname, '../', envFile);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const logger = require('./config/logger');
const pool = require('./config/database');

// Import routes
const authRoutes = require('./api/routes/authRoutes');
const integrationRoutes = require('./api/routes/integrationRoutes');
const schedulerRoutes = require('./api/routes/schedulerRoutes');
const logRoutes = require('./api/routes/logRoutes');
const errorRoutes = require('./api/routes/errorRoutes');
const dashboardRoutes = require('./api/routes/dashboardRoutes');
const emailConfigRoutes = require('./api/routes/emailConfigRoutes');

// Import scheduler service
const schedulerService = require('./services/scheduler/schedulerService');

const app = express();
const PORT = process.env.PORT || 6001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4005',
  credentials: true
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Coupa Middleware API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      integrations: '/api/integrations',
      schedulers: '/api/schedulers',
      logs: '/api/logs',
      dashboard: '/api/dashboard',
      emailConfig: '/api/email-config'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/schedulers', schedulerRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/email-config', emailConfigRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize scheduler service
  try {
    await schedulerService.initialize();
    logger.info('Scheduler service initialized');
  } catch (error) {
    logger.error('Failed to initialize scheduler service:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

module.exports = app;

