const User = require('../models/User');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

const getUsers = async (req, res, next) => {
  try {
    const { status, role, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    let query = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      query = { salonId: req.salonId };
    }

    if (status) query.status = status;
    if (role) query.role = role;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .populate('salonId', 'name')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based user creation (§6, §71, §72 mass assignment protection).
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, salonId } = sanitizeFields(req.body, [
      'name', 'email', 'password', 'role', 'salonId',
    ]);

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'name, email, password, and role are required',
      });
    }

    const validRoles = ['SUPER_ADMIN', 'SALON_OWNER', 'RECEPTIONIST'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `role must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Role-based restrictions (§6, §71)
    if (req.user.role === 'SALON_OWNER') {
      if (role !== 'RECEPTIONIST') {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Salon owners can only create Receptionist accounts',
        });
      }
    }

    // Tenant isolation: Salon Owners can only create users for their own salon (§2.1, §71)
    const targetSalonId = req.user.role === 'SUPER_ADMIN' ? (salonId || null) : req.salonId;

    if (role === 'RECEPTIONIST' && !targetSalonId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'salonId is required for Receptionist role',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'A user with this email address already exists',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      salonId: targetSalonId,
      status: 'ACTIVE',
    });

    logAudit(req, 'USER_CREATED', 'User', user._id, { email: user.email, role: user.role, salonId: targetSalonId });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      salonId: user.salonId,
      status: user.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suspend/Activate user (§5).
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = sanitizeFields(req.body, ['status']);
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Tenant check for non-Super Admin
    const filter = { _id: req.params.id };
    if (req.user.role !== 'SUPER_ADMIN') {
      filter.salonId = req.salonId;
    }

    const user = await User.findOne(filter);
    if (!user) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'User not found' });
    }

    user.status = status;
    await user.save();

    logAudit(req, `USER_STATUS_CHANGED`, 'User', user._id, { newStatus: status });

    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, status: user.status });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser, updateUserStatus };
