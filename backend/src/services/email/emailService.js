const nodemailer = require('nodemailer');
const logger = require('../../config/logger');
const NotificationRecipients = require('../../models/NotificationRecipients');
const emailConfig = require('../../config/email');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.secure, // true for 465, false for other ports
        auth: {
          user: emailConfig.smtpUser,
          pass: emailConfig.smtpPassword,
        },
      });
      logger.info('Email transporter initialized');
    } catch (error) {
      logger.error('Error initializing email transporter:', error);
    }
  }

  async sendSuccessNotification(integrationLog) {
    try {
      const recipients = await NotificationRecipients.findAll();
      
      if (recipients.length === 0) {
        logger.warn('No email recipients configured for success notifications');
        return;
      }

      const emailContent = this.buildSuccessEmailContent(integrationLog);
      const recipientsList = recipients.map(r => r.email);

      const mailOptions = {
        from: emailConfig.fromEmail,
        to: recipientsList,
        subject: `[COUPA-SAP Integration] SUCCESS – ${integrationLog.integration_name} – ${new Date(integrationLog.created_at).toISOString()}`,
        html: emailContent,
        text: this.buildSuccessTextVersion(integrationLog),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Success notification email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending success email notification:', error);
      throw error;
    }
  }

  async sendErrorNotification(integrationLog, errorDetails = []) {
    try {
      const recipients = await NotificationRecipients.findAll();
      
      if (recipients.length === 0) {
        logger.warn('No email recipients configured for error notifications');
        return;
      }

      const shouldNotify = this.shouldSendNotification(integrationLog, recipients);
      if (!shouldNotify) {
        logger.info('Notification suppressed based on recipient preferences');
        return;
      }

      const emailContent = this.buildErrorEmailContent(integrationLog, errorDetails);
      const recipientsList = recipients.map(r => r.email);

      const mailOptions = {
        from: emailConfig.fromEmail,
        to: recipientsList,
        subject: `[COUPA-SAP Integration] ERROR – ${integrationLog.integration_name} – ${new Date(integrationLog.created_at).toISOString()}`,
        html: emailContent,
        text: this.buildTextVersion(integrationLog, errorDetails),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Error notification email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending email notification:', error);
      throw error;
    }
  }

  shouldSendNotification(integrationLog, recipients) {
    // Check if any recipient should receive this notification based on notification_type
    const status = integrationLog.status;
    
    return recipients.some(recipient => {
      const notificationType = recipient.notification_type || 'CRITICAL';
      
      if (notificationType === 'ALL') return true;
      if (notificationType === 'CRITICAL_AND_PARTIAL') {
        return status === 'FAILED' || status === 'PARTIAL';
      }
      if (notificationType === 'CRITICAL') {
        return status === 'FAILED';
      }
      return false;
    });
  }

  buildErrorEmailContent(integrationLog, errorDetails) {
    const statusColor = integrationLog.status === 'FAILED' ? '#dc3545' : '#ffc107';
    const errorTableRows = errorDetails.slice(0, 50).map(error => `
      <tr>
        <td>${error.line_number || 'N/A'}</td>
        <td>${error.field_name || 'N/A'}</td>
        <td>${error.error_message || 'N/A'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 15px; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #4CAF50; color: white; }
          .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .summary { background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Integration Error Alert</h2>
          </div>
          <div class="content">
            <div class="summary">
              <h3>Integration Summary</h3>
              <p><strong>Integration Name:</strong> ${integrationLog.integration_name}</p>
              <p><strong>Timestamp:</strong> ${new Date(integrationLog.created_at).toLocaleString()}</p>
              <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${integrationLog.status}</span></p>
              <p><strong>Total Records:</strong> ${integrationLog.total_records}</p>
              <p><strong>Success Count:</strong> ${integrationLog.success_count}</p>
              <p><strong>Error Count:</strong> ${integrationLog.error_count}</p>
              <p><strong>Duration:</strong> ${integrationLog.duration_ms}ms</p>
            </div>

            ${errorDetails.length > 0 ? `
              <h3>Error Details (showing first 50 errors)</h3>
              <table>
                <thead>
                  <tr>
                    <th>Line Number</th>
                    <th>Field Name</th>
                    <th>Error Message</th>
                  </tr>
                </thead>
                <tbody>
                  ${errorTableRows}
                </tbody>
              </table>
            ` : '<p>No detailed error information available.</p>'}

            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/logs/${integrationLog.id}" class="button">
              View Full Details in Admin UI
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  buildTextVersion(integrationLog, errorDetails) {
    let text = `
Integration Error Alert
======================

Integration Name: ${integrationLog.integration_name}
Timestamp: ${new Date(integrationLog.created_at).toLocaleString()}
Status: ${integrationLog.status}
Total Records: ${integrationLog.total_records}
Success Count: ${integrationLog.success_count}
Error Count: ${integrationLog.error_count}
Duration: ${integrationLog.duration_ms}ms

`;

    if (errorDetails.length > 0) {
      text += 'Error Details:\n';
      text += '-------------\n';
      errorDetails.slice(0, 50).forEach(error => {
        text += `Line ${error.line_number || 'N/A'}: ${error.field_name || 'N/A'} - ${error.error_message || 'N/A'}\n`;
      });
    }

    text += `\nView full details: ${process.env.FRONTEND_URL || 'http://localhost:3001'}/logs/${integrationLog.id}`;
    return text;
  }

  async sendTestEmail(recipientEmail) {
    try {
      const mailOptions = {
        from: emailConfig.fromEmail,
        to: recipientEmail,
        subject: '[COUPA-SAP Integration] Test Email',
        html: `
          <h2>Test Email</h2>
          <p>This is a test email from the Coupa-SAP Integration Middleware.</p>
          <p>If you received this email, your email configuration is working correctly.</p>
        `,
        text: 'This is a test email from the Coupa-SAP Integration Middleware.',
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Test email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending test email:', error);
      throw error;
    }
  }

  async sendDigestNotification(summary) {
    try {
      const recipients = await NotificationRecipients.findAll();
      const recipientsList = recipients.map(r => r.email);

      if (recipientsList.length === 0) {
        return;
      }

      const mailOptions = {
        from: emailConfig.fromEmail,
        to: recipientsList,
        subject: `[COUPA-SAP Integration] Daily Summary – ${new Date().toISOString().split('T')[0]}`,
        html: this.buildDigestContent(summary),
        text: this.buildDigestText(summary),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Digest email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error sending digest email:', error);
      throw error;
    }
  }

  buildDigestContent(summary) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 15px; border-radius: 5px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #4CAF50; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Daily Integration Summary</h2>
          </div>
          <div class="content">
            <h3>Summary Statistics</h3>
            <p><strong>Date:</strong> ${summary.date}</p>
            <p><strong>Total Integrations:</strong> ${summary.totalIntegrations}</p>
            <p><strong>Success Rate:</strong> ${summary.successRate}%</p>
            <p><strong>Total Records Processed:</strong> ${summary.totalRecords}</p>
            <p><strong>Total Errors:</strong> ${summary.totalErrors}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  buildDigestText(summary) {
    return `
Daily Integration Summary
==========================

Date: ${summary.date}
Total Integrations: ${summary.totalIntegrations}
Success Rate: ${summary.successRate}%
Total Records Processed: ${summary.totalRecords}
Total Errors: ${summary.totalErrors}
    `;
  }
}

module.exports = new EmailService();

