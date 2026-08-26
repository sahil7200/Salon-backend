const Appointment = require('../models/Appointment');
const { SERVICE_DURATIONS } = require('../models/Appointment');
const Salon = require('../models/Salon');
const { timeToMinutes, doTimesOverlap } = require('../utils/time');

const createAppointment = async (req, res, next) => {
  try {
    const { client, service, staff, date, startTime } = req.body;
    const salonId = req.salonId;

    // Validate required fields
    if (!client || !service || !staff || !date || !startTime) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'All fields are required: client, service, staff, date, startTime',
      });
    }

    // Validate service exists
    if (!SERVICE_DURATIONS[service]) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid service. Allowed: ${Object.keys(SERVICE_DURATIONS).join(', ')}`,
      });
    }

    // Calculate endTime based on service duration
    const durationMinutes = SERVICE_DURATIONS[service];
    const startMinutes = timeToMinutes(startTime);

    if (isNaN(startMinutes)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid startTime format. Use HH:MM (24h)',
      });
    }

    const endMinutes = startMinutes + durationMinutes;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    // Validate endTime doesn't exceed 24:00
    if (endMinutes >= 24 * 60) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Appointment would end at ${endTime}, which exceeds 24 hours`,
      });
    }

    // Get salon for working hours config
    const salon = await Salon.findById(salonId);
    if (!salon) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Salon not found' });
    }

    // 1. Validate working hours — appointment must fall fully inside 09:00–20:00
    const salonOpen = timeToMinutes(salon.openingTime);
    const salonClose = timeToMinutes(salon.closingTime);

    if (startMinutes < salonOpen || endMinutes > salonClose) {
      return res.status(400).json({
        error: 'OUTSIDE_WORKING_HOURS',
        message: `Appointment must be between ${salon.openingTime} and ${salon.closingTime}`,
      });
    }

    // 2. Staff conflict detection — same staff cannot have overlapping active appointments
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(appointmentDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const overlappingAppointments = await Appointment.find({
      salonId,
      staff,
      date: { $gte: appointmentDate, $lt: nextDay },
      status: { $in: ['PENDING', 'CONFIRMED'] },
    });

    for (const existing of overlappingAppointments) {
      const existStart = timeToMinutes(existing.startTime);
      const existEnd = timeToMinutes(existing.endTime);

      if (doTimesOverlap(startMinutes, endMinutes, existStart, existEnd)) {
        return res.status(409).json({
          error: 'STAFF_CONFLICT',
          message: `Staff member already has an appointment from ${existing.startTime} to ${existing.endTime} on this date`,
          conflictingAppointment: existing._id,
        });
      }
    }

    // Create the appointment
    const appointment = await Appointment.create({
      salonId,
      client,
      service,
      staff,
      date: appointmentDate,
      startTime,
      endTime,
      status: 'PENDING',
    });

    const populated = await appointment.populate([
      { path: 'client', select: 'name phone' },
      { path: 'staff', select: 'name services' },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

const getAppointments = async (req, res, next) => {
  try {
    const salonId = req.salonId;
    const { date, status, staffId } = req.query;

    const filter = { salonId };

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: d, $lt: nextDay };
    }

    if (status) {
      filter.status = status;
    }

    if (staffId) {
      filter.staff = staffId;
    }

    const appointments = await Appointment.find(filter)
      .populate('client', 'name phone email')
      .populate('staff', 'name services')
      .sort({ date: 1, startTime: 1 });

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      salonId: req.salonId,
    })
      .populate('client', 'name phone email')
      .populate('staff', 'name services');

    if (!appointment) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      salonId: req.salonId,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Appointment not found' });
    }

    // Cancellation of already cancelled is a no-op
    if (appointment.status === 'CANCELLED' && status !== 'CANCELLED') {
      return res.status(400).json({
        error: 'INVALID_TRANSITION',
        message: 'Cannot change status of a cancelled appointment',
      });
    }

    appointment.status = status;
    await appointment.save();

    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's appointment count for dashboard
 */
const getTodayCount = async (req, res, next) => {
  try {
    const salonId = req.salonId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const count = await Appointment.countDocuments({
      salonId,
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['PENDING', 'CONFIRMED'] },
    });

    res.json({ count, date: today.toISOString().split('T')[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  getTodayCount,
};
