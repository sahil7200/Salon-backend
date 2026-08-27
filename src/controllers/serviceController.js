const Service = require('../models/Service');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

/**
 * Get active services for the authenticated salon (tenant-isolated, §20).
 */
const getServices = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    const filter = { salonId: req.salonId };
    if (status) {
      filter.isActive = status === 'ACTIVE';
    } else {
      filter.isActive = true;
    }

    const total = await Service.countDocuments(filter);
    const services = await Service.find(filter)
      .sort({ name: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: services,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new service offering for the salon (§20).
 */
const createService = async (req, res, next) => {
  try {
    const { name, durationInMinutes, price } = sanitizeFields(req.body, [
      'name', 'durationInMinutes', 'price',
    ]);

    if (!name || durationInMinutes == null) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'name and durationInMinutes are required',
      });
    }

    const duration = Number(durationInMinutes);
    if (isNaN(duration) || duration < 1) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'durationInMinutes must be a positive number',
      });
    }

    const service = await Service.create({
      salonId: req.salonId,
      name: name.trim(),
      durationInMinutes: duration,
      price: price != null ? Number(price) : 0,
      isActive: true,
    });

    logAudit(req, 'SERVICE_CREATED', 'Service', service._id, { name: service.name, price: service.price });

    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate a service safely (§69).
 * Historical appointments retain their snapshot; new appointments cannot book it.
 */
const deactivateService = async (req, res, next) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, salonId: req.salonId });
    if (!service) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Service not found' });
    }

    service.isActive = false;
    await service.save();

    logAudit(req, 'SERVICE_DEACTIVATED', 'Service', service._id, { name: service.name });

    res.json({ message: 'Service deactivated successfully', service });
  } catch (error) {
    next(error);
  }
};

module.exports = { getServices, createService, deactivateService };
