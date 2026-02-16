const nodemailer = require('nodemailer');
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

const logger = require('../config/logger');

let transporter = null;

function initializeEmailTransporter() {
  if (transporter) {
    return transporter;
  }

  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURITY === 'SSL',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  transporter = nodemailer.createTransport(config);

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      logger.error('Email transporter verification failed:', error);
    } else {
      logger.info('Email transporter ready');
    }
  });

  return transporter;
}

async function sendEmail(options) {
  const emailTransporter = initializeEmailTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@coupa-middleware.com',
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
}

module.exports = {
  initializeEmailTransporter,
  sendEmail,
};

