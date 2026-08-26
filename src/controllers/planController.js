const Plan = require('../models/Plan');

const createPlan = async (req, res, next) => {
  try {
    const { name, price, durationInDays, maxStaff, maxAppointments } = req.body;

    if (!name || price == null || !durationInDays || !maxStaff || !maxAppointments) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'All fields are required: name, price, durationInDays, maxStaff, maxAppointments',
      });
    }

    if (price < 0 || durationInDays < 1 || maxStaff < 1 || maxAppointments < 1) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Numeric fields must be positive',
      });
    }

    const plan = await Plan.create({
      name,
      price,
      durationInDays,
      maxStaff,
      maxAppointments,
    });

    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
};

const getPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    next(error);
  }
};

const getPlanById = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found' });
    }
    res.json(plan);
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found' });
    }

    const { name, price, durationInDays, maxStaff, maxAppointments } = req.body;

    if (name !== undefined) plan.name = name;
    if (price !== undefined) plan.price = price;
    if (durationInDays !== undefined) plan.durationInDays = durationInDays;
    if (maxStaff !== undefined) plan.maxStaff = maxStaff;
    if (maxAppointments !== undefined) plan.maxAppointments = maxAppointments;

    await plan.save();
    res.json(plan);
  } catch (error) {
    next(error);
  }
};

module.exports = { createPlan, getPlans, getPlanById, updatePlan };
