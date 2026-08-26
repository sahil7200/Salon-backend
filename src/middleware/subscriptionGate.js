const Salon = require('../models/Salon');

/**
 * Subscription gating middleware.
 * Blocks salon-scoped requests if the salon's subscription has expired.
 * Super Admin is exempt (they manage subscriptions).
 */
const subscriptionGate = async (req, res, next) => {
  // Super Admin bypasses subscription checks
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Receptionists and Owners need an active subscription
  if (!req.salonId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'No salon associated with this user',
    });
  }

  try {
    const salon = await Salon.findById(req.salonId);

    if (!salon) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Salon not found' });
    }

    if (salon.subscriptionStatus === 'EXPIRED' || salon.subscriptionStatus === 'NONE') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please contact the administrator to renew your plan.',
      });
    }

    // Check if subscription end date has passed
    if (salon.subscriptionEndDate && new Date() > salon.subscriptionEndDate) {
      // Update status to expired
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
