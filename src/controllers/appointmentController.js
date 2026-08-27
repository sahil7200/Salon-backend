const Appointment = require('../models/Appointment');
const { VALID_TRANSITIONS, ACTIVE_APPOINTMENT_STATUSES } = require('../models/Appointment');
const Salon = require('../models/Salon');
const Client = require('../models/Client');
const Staff = require('../models/Staff');
const Service = require('../models/Service');
const { timeToMinutes, doTimesOverlap } = require('../utils/time');
const { isValidDateString, isValidTimeString, isValidObjectId, sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

/**
 * Create appointment — full validation chain per §24 and §85.
 */
const createAppointment = async (req, res, next) => {
  try {
    const salonId = req.salonId;
    const { clientId, serviceId, staffId, date, startTime } = sanitizeFields(req.body, [
      'clientId', 'serviceId', 'staffId', 'date', 'startTime',
      // Legacy field support
      'client', 'service', 'staff',
    ]);

    // Support both legacy field names and new ones
    const resolvedClientId = clientId || req.body.client;
    const resolvedServiceId = serviceId || req.body.serviceId;
    const resolvedStaffId = staffId || req.body.staff;

    // 1. Required fields
    if (!resolvedClientId || !resolvedStaffId || !date || !startTime) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'clientId (or client), staffId (or staff), date, and startTime are required',
      });
    }

    // 2. Date validation (§25)
    if (!isValidDateString(date)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid date format. Use YYYY-MM-DD',
        details: { date: 'Must be a valid date in YYYY-MM-DD format' },
      });
    }

    // 3. Time validation (§26)
    if (!isValidTimeString(startTime)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid startTime format. Use HH:mm (24h)',
        details: { startTime: 'Must use HH:mm format, e.g. 09:00 or 14:30' },
      });
    }

    // 4. Reject past appointments (§64)
    const appointmentDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (appointmentDate < today) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Cannot create appointments in the past',
      });
    }
    // Same day — check if start time has already passed
    if (appointmentDate.getTime() === today.getTime()) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = timeToMinutes(startTime);
      if (startMinutes < nowMinutes) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Cannot create an appointment at a time that has already passed today',
        });
      }
    }

    // 5. Client validation — exists, active, belongs to salon (§6, §7)
    const client = await Client.findOne({ _id: resolvedClientId, salonId });
    if (!client) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Client not found' });
    }
    if (client.status !== 'ACTIVE' && !client.isActive) {
      return res.status(400).json({ error: 'CLIENT_INACTIVE', message: 'Cannot book for an inactive client' });
    }

    // 6. Service resolution — use Service model or legacy hardcoded names
    let serviceName, serviceDuration, servicePrice;
    if (resolvedServiceId && isValidObjectId(resolvedServiceId)) {
      const service = await Service.findOne({ _id: resolvedServiceId, salonId });
      if (!service) {
        return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Service not found' });
      }
      if (!service.isActive) {
        return res.status(400).json({ error: 'SERVICE_INACTIVE', message: 'Cannot book an inactive service' });
      }
      serviceName = service.name;
      serviceDuration = service.durationInMinutes;
      servicePrice = service.price || 0;
    } else {
      // Legacy fallback — accept service name string
      const legacyService = req.body.service;
      const LEGACY_DURATIONS = { 'Haircut': 30, 'Facial': 60, 'Hair Color': 120 };
      if (!legacyService || !LEGACY_DURATIONS[legacyService]) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `serviceId is required, or provide a service name: ${Object.keys(LEGACY_DURATIONS).join(', ')}`,
        });
      }
      serviceName = legacyService;
      serviceDuration = LEGACY_DURATIONS[legacyService];
      servicePrice = 0;
    }

    // 7. Staff validation — exists, active, belongs to salon (§11, §15)
    const staff = await Staff.findOne({ _id: resolvedStaffId, salonId });
    if (!staff) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Staff not found' });
    }
    if (staff.status !== 'ACTIVE' && !staff.isActive) {
      return res.status(400).json({ error: 'STAFF_INACTIVE', message: 'Cannot book an inactive staff member' });
    }

    // 8. Calculate endTime server-side (§27)
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + serviceDuration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

    if (endMinutes >= 24 * 60) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Appointment would end at ${endTime}, which exceeds 24 hours`,
      });
    }

    // 9. Salon validation & working hours (§28-29)
    const salon = await Salon.findById(salonId).populate('currentPlan');
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }

    const salonOpen = timeToMinutes(salon.openingTime);
    const salonClose = timeToMinutes(salon.closingTime);

    if (startMinutes < salonOpen || endMinutes > salonClose) {
      return res.status(400).json({
        error: 'OUTSIDE_WORKING_HOURS',
        message: `Appointment must be between ${salon.openingTime} and ${salon.closingTime}`,
      });
    }

    // 10. Plan appointment limit (§13, §38)
    if (salon.currentPlan) {
      const activeCount = await Appointment.countDocuments({
        salonId,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      });
      if (activeCount >= salon.currentPlan.maxAppointments) {
        return res.status(403).json({
          error: 'LIMIT_REACHED',
          message: `Your plan allows max ${salon.currentPlan.maxAppointments} active appointments. Upgrade to accept more bookings.`,
        });
      }
    }

    // 11. Staff conflict detection (§32-33)
    const apptDate = new Date(date + 'T00:00:00');
    apptDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(apptDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const overlapping = await Appointment.find({
      salonId,
      staff: resolvedStaffId,
      date: { $gte: apptDate, $lt: nextDay },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    });

    for (const existing of overlapping) {
      const existStart = timeToMinutes(existing.startTime);
      const existEnd = timeToMinutes(existing.endTime);
      if (doTimesOverlap(startMinutes, endMinutes, existStart, existEnd)) {
        return res.status(409).json({
          error: 'STAFF_CONFLICT',
          message: `Staff already booked from ${existing.startTime} to ${existing.endTime} on this date`,
          conflictingAppointment: existing._id,
        });
      }
    }

    // 12. Create appointment with snapshots (§21)
    const appointment = await Appointment.create({
      salonId,
      client: resolvedClientId,
      serviceId: resolvedServiceId || null,
      serviceNameSnapshot: serviceName,
      serviceDurationSnapshot: serviceDuration,
      servicePriceSnapshot: servicePrice,
      staff: resolvedStaffId,
      date: apptDate,
      startTime,
      endTime,
      status: 'PENDING',
    });

    // 13. Audit log (§49)
    logAudit(req, 'APPOINTMENT_CREATED', 'Appointment', appointment._id, {
      client: resolvedClientId, staff: resolvedStaffId, service: serviceName, date, startTime, endTime,
    });

    const populated = await appointment.populate([
      { path: 'client', select: 'name phone' },
      { path: 'staff', select: 'name' },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

/**
 * List appointments with pagination (§74).
 */
const getAppointments = async (req, res, next) => {
  try {
    const salonId = req.salonId;
    const { date, status, staffId, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Cap at 100 (§74)

    const filter = { salonId };

    if (date) {
      if (!isValidDateString(date)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid date format' });
      }
      const d = new Date(date + 'T00:00:00');
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

    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .populate('client', 'name phone email')
      .populate('staff', 'name')
      .sort({ date: 1, startTime: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
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
      .populate('staff', 'name');

    if (!appointment) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

/**
 * Update appointment status with state machine enforcement (§22-23).
 * Completed appointments are largely immutable (§35).
 */
const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { status, cancellationReason, notes } = sanitizeFields(req.body, [
      'status', 'cancellationReason', 'notes',
    ]);

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      salonId: req.salonId,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Appointment not found' });
    }

    // Allow adding notes to any appointment (§35)
    if (notes !== undefined && !status) {
      appointment.notes = notes;
      await appointment.save();
      return res.json(appointment);
    }

    if (!status) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'status is required',
      });
    }

    // Enforce state machine transitions (§23)
    const allowed = VALID_TRANSITIONS[appointment.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        error: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition from '${appointment.status}' to '${status}'. Allowed: ${(allowed || []).join(', ') || 'none (terminal state)'}`,
      });
    }

    const previousStatus = appointment.status;
    appointment.status = status;

    // Cancellation metadata (§36)
    if (status === 'CANCELLED') {
      appointment.cancelledAt = new Date();
      appointment.cancelledBy = req.user._id;
      appointment.cancellationReason = cancellationReason || '';
    }

    if (notes !== undefined) {
      appointment.notes = notes;
    }

    await appointment.save();

    logAudit(req, 'APPOINTMENT_STATUS_CHANGED', 'Appointment', appointment._id, {
      previousStatus, newStatus: status, cancellationReason,
    });

    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's appointment count for dashboard.
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
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
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
