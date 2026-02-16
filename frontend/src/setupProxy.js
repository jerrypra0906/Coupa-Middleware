const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_BASE_URL?.replace('/api', '') || 'http://localhost:6001',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
    })
  );
};


