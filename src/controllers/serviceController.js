const Service = require('../models/Service');

/**
 * Get active services for the authenticated salon (tenant-isolated).
 */
const getServices = async (req, res, next) => {
  try {
    const services = await Service.find({ salonId: req.salonId, isActive: true }).sort({ name: 1 });
    res.json(services);
  } catch (error) {
    next(error);
  }
};

module.exports = { getServices };
