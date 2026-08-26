const Salon = require('../models/Salon');
const Plan = require('../models/Plan');
const SubscriptionHistory = require('../models/SubscriptionHistory');

const getSalons = async (req, res, next) => {
  try {
    // Super Admin sees all, others see only their salon
    let query = {};
    if (req.user.role === 'SUPER_ADMIN') {
      query = { isActive: true };
    } else {
      query = { _id: req.salonId, isActive: true };
    }

    const salons = await Salon.find(query)
      .populate('ownerId', 'name email')
      .populate('currentPlan', 'name price durationInDays maxStaff maxAppointments');

    res.json(salons);
  } catch (error) {
    next(error);
  }
};

const getSalonById = async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id)
      .populate('ownerId', 'name email')
      .populate('currentPlan', 'name price durationInDays maxStaff maxAppointments');

    if (!salon) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Salon not found' });
    }

    // Tenant isolation: non-admin users can only view their own salon
    if (req.user.role !== 'SUPER_ADMIN' && salon._id.toString() !== req.salonId?.toString()) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied to this salon' });
    }

    res.json(salon);
  } catch (error) {
    next(error);
  }
};

/**
 * Assign a plan to a salon (Super Admin only).
 * @action ASSIGN - First-time plan assignment
 * @action RENEW - Extending current plan
 * @action UPGRADE - Switching to a higher plan
 */
const assignPlan = async (req, res, next) => {
  try {
    const { salonId, planId, action } = req.body;

    if (!salonId || !planId || !action) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'salonId, planId, and action (ASSIGN|RENEW|UPGRADE) are required',
      });
    }

    if (!['ASSIGN', 'RENEW', 'UPGRADE'].includes(action)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'action must be ASSIGN, RENEW, or UPGRADE',
      });
    }

    const salon = await Salon.findById(salonId);
    if (!salon) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Salon not found' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found or inactive' });
    }

    const now = new Date();
    let startDate, endDate;

    if (action === 'ASSIGN' || !salon.subscriptionEndDate) {
      // Fresh assignment or no existing subscription
      startDate = now;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.durationInDays);
    } else if (action === 'RENEW') {
      // Renewal starts from the current end date (or today if expired)
      startDate = salon.subscriptionEndDate > now ? salon.subscriptionEndDate : now;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationInDays);
    } else if (action === 'UPGRADE') {
      // Upgrade starts today
      startDate = now;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.durationInDays);
    }

    // Update salon subscription
    salon.currentPlan = planId;
    salon.subscriptionStartDate = startDate;
    salon.subscriptionEndDate = endDate;
    salon.subscriptionStatus = 'ACTIVE';
    await salon.save();

    // Create subscription history record
    const history = await SubscriptionHistory.create({
      salonId: salonId,
      planId: planId,
      startDate,
      endDate,
      price: plan.price,
      action,
    });

    res.status(201).json({
      salon: {
        id: salon._id,
        name: salon.name,
        subscriptionStatus: salon.subscriptionStatus,
        subscriptionStartDate: salon.subscriptionStartDate,
        subscriptionEndDate: salon.subscriptionEndDate,
        currentPlan: plan,
      },
      history,
    });
  } catch (error) {
    next(error);
  }
};

const getSubscriptionHistory = async (req, res, next) => {
  try {
    // Super Admin can see all, salon users only see their own
    const filter = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      filter.salonId = req.salonId;
    }

    const history = await SubscriptionHistory.find(filter)
      .populate('salonId', 'name')
      .populate('planId', 'name price durationInDays')
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    next(error);
  }
};

module.exports = { getSalons, getSalonById, assignPlan, getSubscriptionHistory };
