const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware (§4, §5).
 * Validates JWT token and checks user operational state (ACTIVE/SUSPENDED/DEACTIVATED).
 */
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found or token invalid' });
    }

    // Check account status (§5)
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended' });
    }

    if (user.status === 'DEACTIVATED' || !user.isActive) {
      return res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'Your account has been deactivated' });
    }

    req.user = user;
    req.salonId = user.salonId || null; // null for SUPER_ADMIN
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token has expired' });
    }
    next(error);
  }
};

module.exports = auth;
