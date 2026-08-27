const Salon = require('../models/Salon');
const Plan = require('../models/Plan');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const User = require('../models/User');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

const getSalons = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    let query = {};
    if (req.user.role === 'SUPER_ADMIN') {
      if (status) query.status = status;
    } else {
      query = { _id: req.salonId };
    }

    const total = await Salon.countDocuments(query);
    const salons = await Salon.find(query)
      .populate('ownerId', 'name email status')
      .populate('currentPlan', 'name price durationInDays maxStaff maxAppointments')
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

const getSalonById = async (req, res, next) => {
  try {
    const salon = await Salon.findById(req.params.id)
      .populate('ownerId', 'name email status')
      .populate('currentPlan', 'name price durationInDays maxStaff maxAppointments');

    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    // Tenant isolation: non-admin users can only view their own salon (§3, §7)
    if (req.user.role !== 'SUPER_ADMIN' && salon._id.toString() !== req.salonId?.toString()) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' }); // Hide existence (§3)
    }

    res.json(salon);
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin creates salon directly (§6, §55).
 */
const createSalon = async (req, res, next) => {
  try {
    const { name, ownerName, ownerEmail, ownerPassword, address, phone, planId, latitude, longitude, allowedRadius } = sanitizeFields(req.body, [
      'name', 'ownerName', 'ownerEmail', 'ownerPassword', 'address', 'phone', 'planId', 'latitude', 'longitude', 'allowedRadius',
    ]);

    if (!name || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Salon name, ownerEmail, and ownerPassword are required',
      });
    }

    const normalizedEmail = ownerEmail.trim().toLowerCase();

    let owner = await User.findOne({ email: normalizedEmail });
    if (!owner) {
      owner = await User.create({
        name: ownerName ? ownerName.trim() : `${name.trim()} Owner`,
        email: normalizedEmail,
        password: ownerPassword,
        role: 'SALON_OWNER',
        status: 'ACTIVE',
      });
    }

    let selectedPlan = null;
    if (planId) {
      selectedPlan = await Plan.findById(planId);
    }
    if (!selectedPlan) {
      selectedPlan = await Plan.findOne({ name: 'Basic' }) || await Plan.findOne({ isActive: true });
    }

    const now = new Date();
    const durationDays = selectedPlan ? selectedPlan.durationInDays : 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    const salon = await Salon.create({
      name: name.trim(),
      ownerId: owner._id,
      address: address ? address.trim() : '123 Main Street',
      phone: phone ? phone.trim() : '+91-9876543210',
      latitude: latitude != null ? Number(latitude) : 19.0760,
      longitude: longitude != null ? Number(longitude) : 72.8777,
      allowedRadius: allowedRadius != null ? Number(allowedRadius) : 100,
      openingTime: '09:00',
      closingTime: '20:00',
      currentPlan: selectedPlan ? selectedPlan._id : null,
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      subscriptionStatus: 'ACTIVE',
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
 * Assign, renew, or upgrade plan (Super Admin only, §12, §58, §59).
 * Renewal stacks: newEndDate = existingEndDate + duration so customers don't lose time (§59).
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
      // Renewal stacking (§59): if active, extend existingEndDate by duration; if expired, start from now
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
 * Suspend/Activate salon (Super Admin only, §8).
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

const updateSalon = async (req, res, next) => {
  try {
    const { name, address, phone, latitude, longitude, allowedRadius, openingTime, closingTime } = sanitizeFields(req.body, [
      'name', 'address', 'phone', 'latitude', 'longitude', 'allowedRadius', 'openingTime', 'closingTime',
    ]);

    const salon = await Salon.findById(req.params.id);
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && salon._id.toString() !== req.salonId?.toString()) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to update this salon' });
    }

    if (name) salon.name = name.trim();
    if (address != null) salon.address = address.trim();
    if (phone != null) salon.phone = phone.trim();
    if (latitude != null && !isNaN(Number(latitude))) salon.latitude = Number(latitude);
    if (longitude != null && !isNaN(Number(longitude))) salon.longitude = Number(longitude);
    if (allowedRadius != null && !isNaN(Number(allowedRadius))) salon.allowedRadius = Number(allowedRadius);
    if (openingTime) salon.openingTime = openingTime;
    if (closingTime) salon.closingTime = closingTime;

    await salon.save();

    logAudit(req, 'SALON_UPDATED', 'Salon', salon._id, {
      latitude: salon.latitude,
      longitude: salon.longitude,
      allowedRadius: salon.allowedRadius,
    });

    res.json(salon);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSalons,
  getSalonById,
  createSalon,
  updateSalon,
  assignPlan,
  updateSalonStatus,
  getSubscriptionHistory,
};
