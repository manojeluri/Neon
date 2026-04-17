const app = require('../backend/server');

module.exports = (req, res) => {
  // Debug: log what URL Vercel passes to Express
  console.log('[vercel-fn] method:', req.method, 'url:', req.url);
  return app(req, res);
};
