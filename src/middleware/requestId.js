const crypto = require('crypto');

/**
 * Attach a unique requestId to every incoming request (§82).
 * Enables log correlation for production debugging.
 */
const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

module.exports = requestId;
