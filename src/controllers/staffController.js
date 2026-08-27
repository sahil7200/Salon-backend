const Staff = require('../models/Staff');
const Salon = require('../models/Salon');
const Appointment = require('../models/Appointment');
const { ACTIVE_APPOINTMENT_STATUSES } = require('../models/Appointment');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

const createStaff = async (req, res, next) => {
  try {
    const { name, phone, services } = sanitizeFields(req.body, ['name', 'phone', 'services']);

    if (!name || !phone) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and phone are required',
      });
    }

    // Check duplicate phone in same salon (§16)
    const existing = await Staff.findOne({ salonId: req.salonId, phone: phone.trim() });
    if (existing) {
      return res.status(409).json({
        error: 'PHONE_EXISTS',
        message: 'A staff member with this phone number already exists in your salon',
      });
    }

    // Check salon subscription plan staff limit (§13, §16)
    const salon = await Salon.findById(req.salonId).populate('currentPlan');
    if (salon && salon.currentPlan) {
      const currentStaffCount = await Staff.countDocuments({
        salonId: req.salonId,
        $or: [{ status: 'ACTIVE' }, { isActive: true }],
      });
      if (currentStaffCount >= salon.currentPlan.maxStaff) {
        return res.status(403).json({
          error: 'LIMIT_REACHED',
          message: `Your plan ('${salon.currentPlan.name}') allows a maximum of ${salon.currentPlan.maxStaff} staff members. Please upgrade your subscription to add more.`,
        });
      }
    }

    const staff = await Staff.create({
      salonId: req.salonId,
      name: name.trim(),
      phone: phone.trim(),
      services: services || ['Haircut', 'Facial', 'Hair Color'],
      status: 'ACTIVE',
      isActive: true,
    });

    logAudit(req, 'STAFF_CREATED', 'Staff', staff._id, { name: staff.name, phone: staff.phone });

    res.status(201).json(staff);
  } catch (error) {
    next(error);
  }
};

const getStaff = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    // Support both status field and legacy isActive/missing status field
    const filter = { salonId: req.salonId };
    if (status === 'INACTIVE') {
      filter.$or = [{ status: 'INACTIVE' }, { isActive: false }];
    } else {
      filter.$or = [{ status: 'ACTIVE' }, { isActive: true }, { status: { $exists: false } }];
    }

    const total = await Staff.countDocuments(filter);
    const staffList = await Staff.find(filter)
      .sort({ name: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: staffList,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate staff safely (§68).
 * Rejects deactivation if future active appointments exist.
 */
const deactivateStaff = async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ _id: req.params.id, salonId: req.salonId });
    if (!staff) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Staff member not found' });
    }

    // Check future active appointments (§68)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureCount = await Appointment.countDocuments({
      salonId: req.salonId,
      staff: staff._id,
      date: { $gte: today },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });

    if (futureCount > 0) {
      return res.status(400).json({
        error: 'STAFF_HAS_FUTURE_APPOINTMENTS',
        message: `Cannot deactivate staff member. They have ${futureCount} future active appointment(s). Reassign or cancel them first.`,
        futureAppointmentCount: futureCount,
      });
    }

    staff.status = 'INACTIVE';
    staff.isActive = false;
    await staff.save();

    logAudit(req, 'STAFF_DEACTIVATED', 'Staff', staff._id, { name: staff.name });

    res.json({ message: 'Staff member deactivated successfully', staff });
  } catch (error) {
    next(error);
  }
};

module.exports = { createStaff, getStaff, deactivateStaff };
