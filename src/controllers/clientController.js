const Client = require('../models/Client');

const createClient = async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and phone are required',
      });
    }

    const client = await Client.create({
      salonId: req.salonId,
      name,
      phone,
      email,
    });

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

const getClients = async (req, res, next) => {
  try {
    const clients = await Client.find({ salonId: req.salonId, isActive: true })
      .sort({ name: 1 });
    res.json(clients);
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
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
};

module.exports = { createClient, getClients, getClientById };
