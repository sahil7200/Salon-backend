const User = require('../models/User');

const getUsers = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      query = { salonId: req.salonId };
    }

    const users = await User.find(query)
      .select('-password')
      .populate('salonId', 'name')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, salonId } = req.body;

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

    // Role-based restrictions
    if (req.user.role === 'SALON_OWNER') {
      if (role !== 'RECEPTIONIST') {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Salon owners can only create Receptionist accounts',
        });
      }
    }

    const targetSalonId = req.user.role === 'SUPER_ADMIN' ? (salonId || null) : req.salonId;

    if (role === 'RECEPTIONIST' && !targetSalonId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'salonId is required for Receptionist role',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'A user with this email already exists',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      salonId: targetSalonId,
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      salonId: user.salonId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, createUser };
