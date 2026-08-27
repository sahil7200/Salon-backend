const User = require('../models/User');
const { generateToken } = require('../utils/token');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'ACCOUNT_DISABLED',
        message: 'Your account has been disabled',
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        salonId: user.salonId,
      },
    });
const register = async (req, res, next) => {
  try {
    const { name, email, password, salonName, phone, address } = req.body;

    if (!name || !email || !password || !salonName) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name, email, password, and salonName are required',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'A user with this email already exists',
      });
    }

    const Plan = require('../models/Plan');
    const Salon = require('../models/Salon');
    const SubscriptionHistory = require('../models/SubscriptionHistory');

    let defaultPlan = await Plan.findOne({ name: 'Basic' });
    if (!defaultPlan) {
      defaultPlan = await Plan.findOne({ isActive: true });
    }

    const owner = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'SALON_OWNER',
    });

    const now = new Date();
    const durationDays = defaultPlan ? defaultPlan.durationInDays : 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    const salon = await Salon.create({
      name: salonName,
      ownerId: owner._id,
      phone: phone || '+91-0000000000',
      address: address || 'Default Salon Address',
      latitude: 19.0760,
      longitude: 72.8777,
      allowedRadius: 100,
      openingTime: '09:00',
      closingTime: '20:00',
      currentPlan: defaultPlan ? defaultPlan._id : null,
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      subscriptionStatus: 'ACTIVE',
    });

    owner.salonId = salon._id;
    await owner.save();

    if (defaultPlan) {
      await SubscriptionHistory.create({
        salonId: salon._id,
        planId: defaultPlan._id,
        startDate: now,
        endDate,
        price: defaultPlan.price,
        action: 'ASSIGN',
      });
    }

    const token = generateToken(owner);

    res.status(201).json({
      token,
      user: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
        salonId: owner.salonId,
      },
      salon: {
        id: salon._id,
        name: salon.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, register };
