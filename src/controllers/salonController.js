const Salon = require('../models/Salon');
const Plan = require('../models/Plan');
const User = require('../User');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const { sanitizeFields } = require('../utils/sanitize');
const { logAudit } = require('../utils/auditLogger');

/**
 * Get all salons (Super Admin sees all, Salon Owner/Receptionist sees their own salon).
 */
const getSalons = async (req, res, next) => {
  try {
    const { status, subscriptionStatus, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    const filter = {};

    if (req.user.role !== 'SUPER_ADMIN') {
      filter._id = req.salonId;
    } else {
      if (status) filter.status = status;
      if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
        ];
      }
    }

    const total = await Salon.countDocuments(filter);
    const salons = await Salon.find(filter)
      .populate('ownerId', 'name email phone')
      .populate('currentPlan')
      .populate('pendingPlan')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: salons,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get salon by ID.
 */
const getSalonById = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.params.id !== req.salonId.toString()) {
      return res.status(403).json({ error: 'FORBIDDEN_ACCESS', message: 'Access to this salon is forbidden' });
    }

    const salon = await Salon.findById(req.params.id)
      .populate('ownerId', 'name email phone')
      .populate('currentPlan')
      .populate('pendingPlan');

    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    res.json(salon);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new salon + owner user (Super Admin only, §11, §32).
 */
const createSalon = async (req, res, next) => {
  try {
    const { name, ownerName, ownerEmail, ownerPassword, address, phone, planId } = sanitizeFields(req.body, [
      'name', 'ownerName', 'ownerEmail', 'ownerPassword', 'address', 'phone', 'planId'
    ]);

    if (!name || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'name, ownerEmail, and ownerPassword are required',
      });
    }

    const normalizedEmail = ownerEmail.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'DUPLICATE_RESOURCE', message: 'User with this email already exists' });
    }

    let selectedPlan = null;
    if (planId) {
      selectedPlan = await Plan.findById(planId);
      if (!selectedPlan || !selectedPlan.isActive) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Selected plan is invalid or inactive' });
      }
    } else {
      selectedPlan = await Plan.findOne({ isDefaultTrial: true, isActive: true });
    }

    const owner = await User.create({
      name: ownerName || name + ' Owner',
      email: normalizedEmail,
      password: ownerPassword,
      role: 'SALON_OWNER',
    });

    const now = new Date();
    const durationDays = selectedPlan ? selectedPlan.durationInDays : 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    const salon = await Salon.create({
      name,
      ownerId: owner._id,
      address,
      phone,
      currentPlan: selectedPlan ? selectedPlan._id : undefined,
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      subscriptionStatus: selectedPlan?.isDefaultTrial ? 'TRIAL' : 'ACTIVE',
      status: 'ACTIVE',
    });

    owner.salonId = salon._id;
    await owner.save();

    if (selectedPlan) {
      await SubscriptionHistory.create({
        salonId: salon._id,
        planId: selectedPlan._id,
        startDate: now,
        endDate,
        price: selectedPlan.price,
        action: 'ASSIGN',
        performedBy: req.user._id,
      });
    }

    logAudit(req, 'SALON_CREATED', 'Salon', salon._id, { name: salon.name, ownerEmail: normalizedEmail });

    res.status(201).json(salon);
  } catch (error) {
    next(error);
  }
};

/**
 * Request subscription plan by Salon Owner (§12).
 */
const requestSubscription = async (req, res, next) => {
  try {
    const { planId } = sanitizeFields(req.body, ['planId']);
    if (!planId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'planId is required' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Subscription plan not found' });
    }

    const salon = await Salon.findById(req.salonId);
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    salon.pendingPlan = plan._id;
    salon.pendingPlanRequestedAt = new Date();
    salon.subscriptionStatus = 'PENDING_APPROVAL';
    await salon.save();

    await salon.populate('pendingPlan');
    await salon.populate('currentPlan');

    logAudit(req, 'PLAN_REQUESTED', 'Salon', salon._id, { planId: plan._id, planName: plan.name });

    res.json({
      message: `Subscription request for '${plan.name}' submitted successfully. Pending Super Admin approval.`,
      salon,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or Reject Subscription Request (Super Admin only).
 */
const approveSubscriptionRequest = async (req, res, next) => {
  try {
    const { salonId, approve } = req.body;
    if (!salonId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'salonId is required' });
    }

    const salon = await Salon.findById(salonId).populate('pendingPlan');
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    if (!salon.pendingPlan) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Salon has no pending plan request' });
    }

    const plan = salon.pendingPlan;

    if (approve) {
      const previousPlanId = salon.currentPlan;
      const now = new Date();
      const startDate = now;
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.durationInDays);

      salon.currentPlan = plan._id;
      salon.subscriptionStartDate = startDate;
      salon.subscriptionEndDate = endDate;
      salon.subscriptionStatus = 'ACTIVE';
      salon.pendingPlan = undefined;
      salon.pendingPlanRequestedAt = undefined;
      await salon.save();

      await SubscriptionHistory.create({
        salonId: salon._id,
        planId: plan._id,
        previousPlanId,
        startDate,
        endDate,
        price: plan.price,
        action: 'UPGRADE',
        performedBy: req.user._id,
      });

      logAudit(req, 'PLAN_REQUEST_APPROVED', 'Salon', salon._id, { planId: plan._id });

      res.json({ message: `Plan '${plan.name}' approved and activated for ${salon.name}`, salon });
    } else {
      salon.pendingPlan = undefined;
      salon.pendingPlanRequestedAt = undefined;
      salon.subscriptionStatus = salon.subscriptionEndDate && new Date(salon.subscriptionEndDate) > new Date() ? 'ACTIVE' : 'EXPIRED';
      await salon.save();

      logAudit(req, 'PLAN_REQUEST_REJECTED', 'Salon', salon._id, { planId: plan._id });

      res.json({ message: `Subscription request rejected for ${salon.name}`, salon });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Assign, renew, or upgrade plan (Super Admin only).
 */
const assignPlan = async (req, res, next) => {
  try {
    const { salonId, planId, action } = sanitizeFields(req.body, ['salonId', 'planId', 'action']);

    if (!salonId || !planId || !action) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'salonId, planId, and action (ASSIGN|RENEW|UPGRADE|DOWNGRADE) are required',
      });
    }

    const validActions = ['ASSIGN', 'RENEW', 'UPGRADE', 'DOWNGRADE'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `action must be one of: ${validActions.join(', ')}`,
      });
    }

    const salon = await Salon.findById(salonId);
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Plan not found or inactive' });
    }

    const previousPlanId = salon.currentPlan;
    const now = new Date();
    let startDate, endDate;

    if (action === 'ASSIGN' || !salon.subscriptionEndDate) {
      startDate = now;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.durationInDays);
    } else if (action === 'RENEW') {
      const currentEnd = new Date(salon.subscriptionEndDate);
      startDate = currentEnd > now ? currentEnd : now;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationInDays);
    } else if (action === 'UPGRADE' || action === 'DOWNGRADE') {
      startDate = now;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + plan.durationInDays);
    }

    salon.currentPlan = planId;
    salon.subscriptionStartDate = startDate;
    salon.subscriptionEndDate = endDate;
    salon.subscriptionStatus = 'ACTIVE';
    salon.pendingPlan = undefined;
    salon.pendingPlanRequestedAt = undefined;
    await salon.save();

    const history = await SubscriptionHistory.create({
      salonId,
      planId,
      previousPlanId,
      startDate,
      endDate,
      price: plan.price,
      action,
      performedBy: req.user._id,
    });

    logAudit(req, `PLAN_${action}`, 'Salon', salon._id, { planId, action, newEndDate: endDate });

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

/**
 * Suspend/Activate salon (Super Admin only).
 */
const updateSalonStatus = async (req, res, next) => {
  try {
    const { status } = sanitizeFields(req.body, ['status']);
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'CLOSED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const salon = await Salon.findById(req.params.id);
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    const prevStatus = salon.status;
    salon.status = status;
    await salon.save();

    logAudit(req, status === 'SUSPENDED' ? 'SALON_SUSPENDED' : 'SALON_REACTIVATED', 'Salon', salon._id, {
      previousStatus: prevStatus,
      newStatus: status,
    });

    res.json(salon);
  } catch (error) {
    next(error);
  }
};

const getSubscriptionHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    const filter = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      filter.salonId = req.salonId;
    }

    const total = await SubscriptionHistory.countDocuments(filter);
    const history = await SubscriptionHistory.find(filter)
      .populate('salonId', 'name')
      .populate('planId', 'name price durationInDays')
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: history,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSalons,
  getSalonById,
  createSalon,
  requestSubscription,
  approveSubscriptionRequest,
  assignPlan,
  updateSalonStatus,
  getSubscriptionHistory,
};
