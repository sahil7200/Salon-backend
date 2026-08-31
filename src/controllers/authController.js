const User = require('../models/User');
const { generateToken } = require('../utils/token');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');
const { sendUserCredentialsEmail } = require('../services/emailService');

const login = async (req, res, next) => {
  try {
    const { email, password } = sanitizeFields(req.body, ['email', 'password']);

    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // Generic error message for both unknown email and wrong password (§79)
    if (!user || !(await user.comparePassword(password))) {
      logAudit(req, 'LOGIN_FAILED', 'User', null, { email: email.toLowerCase() });
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // Account status check (§5)
    if (user.status === 'SUSPENDED') {
      logAudit(req, 'LOGIN_BLOCKED_SUSPENDED', 'User', user._id);
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended',
      });
    }

    if (user.status === 'DEACTIVATED' || !user.isActive) {
      logAudit(req, 'LOGIN_BLOCKED_DISABLED', 'User', user._id);
      return res.status(403).json({
        error: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated',
      });
    }

    const token = generateToken(user);
    logAudit(req, 'LOGIN_SUCCESS', 'User', user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        salonId: user.salonId,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Self-service registration for Salon Owner + Salon trial (§55, §56).
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, salonName, phone, address } = sanitizeFields(req.body, [
      'name', 'email', 'password', 'salonName', 'phone', 'address',
    ]);

    if (!name || !email || !password || !salonName) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name, email, password, and salonName are required',
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

    const Plan = require('../models/Plan');
    const Salon = require('../models/Salon');
    const SubscriptionHistory = require('../models/SubscriptionHistory');

    let defaultPlan = await Plan.findOne({ name: 'Basic' });
    if (!defaultPlan) {
      defaultPlan = await Plan.findOne({ isActive: true });
    }

    // Create Salon Owner user first
    const owner = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'SALON_OWNER',
      status: 'ACTIVE',
    });

    const now = new Date();
    const durationDays = defaultPlan ? defaultPlan.durationInDays : 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + durationDays);

    // Create Salon with TRIAL status (§56)
    const salon = await Salon.create({
      name: salonName.trim(),
      ownerId: owner._id,
      phone: phone ? phone.trim() : '+91-0000000000',
      address: address ? address.trim() : 'Default Salon Address',
      latitude: 19.0760,
      longitude: 72.8777,
      allowedRadius: 100,
      openingTime: '09:00',
      closingTime: '20:00',
      currentPlan: defaultPlan ? defaultPlan._id : null,
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      subscriptionStatus: 'TRIAL',
      status: 'ACTIVE',
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
        performedBy: owner._id,
      });
    }

    const token = generateToken(owner);

    logAudit(req, 'USER_REGISTERED', 'User', owner._id, { salonId: salon._id, salonName: salon.name });

    // Send credentials email asynchronously
    sendUserCredentialsEmail({
      name: owner.name,
      email: owner.email,
      password,
      role: owner.role,
      salonName: salon.name,
    }).catch((emailErr) => {
      console.error('[register] Error sending welcome credentials email:', emailErr.message);
    });

    res.status(201).json({
      token,
      user: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
        salonId: owner.salonId,
        status: owner.status,
      },
      salon: {
        id: salon._id,
        name: salon.name,
        subscriptionStatus: salon.subscriptionStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, register };
