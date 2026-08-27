const Client = require('../models/Client');
const Appointment = require('../models/Appointment');
const { ACTIVE_APPOINTMENT_STATUSES } = require('../models/Appointment');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

const createClient = async (req, res, next) => {
  try {
    const { name, phone, email, notes } = sanitizeFields(req.body, ['name', 'phone', 'email', 'notes']);

    if (!name || !phone) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and phone are required',
      });
    }

    const normalizedPhone = phone.trim();

    // Check duplicate phone (§19)
    const existing = await Client.findOne({ salonId: req.salonId, phone: normalizedPhone });
    if (existing) {
      return res.status(409).json({
        error: 'PHONE_EXISTS',
        message: 'A client with this phone number already exists in your salon',
        existingClientId: existing._id,
      });
    }

    const client = await Client.create({
      salonId: req.salonId,
      name: name.trim(),
      phone: normalizedPhone,
      email: email ? email.trim().toLowerCase() : undefined,
      notes: notes || '',
      status: 'ACTIVE',
    });

    logAudit(req, 'CLIENT_CREATED', 'Client', client._id, { name: client.name, phone: client.phone });

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

const getClients = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    // Strict tenant isolation + search (§75)
    const filter = { salonId: req.salonId, status: 'ACTIVE' };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const total = await Client.countDocuments(filter);
    const clients = await Client.find(filter)
      .sort({ name: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: clients,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

const getClientById = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      salonId: req.salonId,
    });

    if (!client) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate client safely (§70).
 */
const deactivateClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, salonId: req.salonId });
    if (!client) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Client not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureCount = await Appointment.countDocuments({
      salonId: req.salonId,
      client: client._id,
      date: { $gte: today },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });

    if (futureCount > 0) {
      return res.status(400).json({
        error: 'CLIENT_HAS_FUTURE_APPOINTMENTS',
        message: `Cannot deactivate client. They have ${futureCount} future active appointment(s).`,
        futureAppointmentCount: futureCount,
      });
    }

    client.status = 'INACTIVE';
    await client.save();

    logAudit(req, 'CLIENT_DEACTIVATED', 'Client', client._id, { name: client.name });

    res.json({ message: 'Client deactivated successfully', client });
  } catch (error) {
    next(error);
  }
};

module.exports = { createClient, getClients, getClientById, deactivateClient };
