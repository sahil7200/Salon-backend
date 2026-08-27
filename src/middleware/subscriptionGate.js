const Salon = require('../models/Salon');

/**
 * Subscription gating & operational status middleware (§8, §10).
 * Validates subscription status AND end date using `>=` (§10 edge case).
 * Blocks salon-scoped operations if expired, suspended, or closed.
 * Super Admin is exempt.
 */
const subscriptionGate = async (req, res, next) => {
  // Super Admin bypasses subscription checks
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (!req.salonId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'No salon associated with this user',
    });
  }

  try {
    const salon = await Salon.findById(req.salonId);

    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    // Check salon operational status (§8)
    if (salon.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_SUSPENDED',
        message: 'Salon operations are currently suspended. Please contact platform administrator.',
      });
    }

    if (salon.status === 'CLOSED') {
      return res.status(403).json({
        error: 'SALON_CLOSED',
        message: 'Salon is permanently closed',
      });
    }

    // Check subscription status
    if (salon.subscriptionStatus === 'EXPIRED' || salon.subscriptionStatus === 'SUSPENDED') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please contact the administrator to renew your plan.',
      });
    }

    // Strict boundary check: use >= to avoid one-moment validity bug (§10)
    const now = new Date();
    if (salon.subscriptionEndDate && now >= new Date(salon.subscriptionEndDate)) {
      salon.subscriptionStatus = 'EXPIRED';
      await salon.save();

      return res.status(403).json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please contact the administrator to renew your plan.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = subscriptionGate;
