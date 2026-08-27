const Staff = require('../models/Staff');
const Salon = require('../models/Salon');

const createStaff = async (req, res, next) => {
  try {
    const { name, phone, services } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and phone are required',
      });
    }

    // Check salon subscription plan staff limit
    const salon = await Salon.findById(req.salonId).populate('currentPlan');
    if (salon && salon.currentPlan) {
      const currentStaffCount = await Staff.countDocuments({ salonId: req.salonId, isActive: true });
      if (currentStaffCount >= salon.currentPlan.maxStaff) {
        return res.status(403).json({
          error: 'LIMIT_REACHED',
          message: `Your current plan ('${salon.currentPlan.name}') allows a maximum of ${salon.currentPlan.maxStaff} staff members. Please upgrade your subscription to add more.`,
        });
      }
    }

    const staff = await Staff.create({
      salonId: req.salonId,
      name,
      phone,
      services: services || [],
    });

    res.status(201).json(staff);
  } catch (error) {
    next(error);
  }
};

const getStaff = async (req, res, next) => {
  try {
    const staffList = await Staff.find({ salonId: req.salonId, isActive: true })
      .sort({ name: 1 });
    res.json(staffList);
  } catch (error) {
    next(error);
  }
};

module.exports = { createStaff, getStaff };
