const Staff = require('../models/Staff');

const createStaff = async (req, res, next) => {
  try {
    const { name, phone, services } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and phone are required',
      });
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
