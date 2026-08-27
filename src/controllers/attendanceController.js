const Attendance = require('../models/Attendance');
const Salon = require('../models/Salon');
const Staff = require('../models/Staff');
const { haversineDistance } = require('../utils/haversine');
const { sanitizeFields } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

/**
 * Staff check-in endpoint (§41-43, §45-47).
 * Calculates Haversine distance server-side.
 * Prevents duplicate check-in if staff is already CHECKED_IN.
 */
const checkIn = async (req, res, next) => {
  try {
    const { latitude, longitude } = sanitizeFields(req.body, ['latitude', 'longitude']);

    // 1. Missing coordinates check (§45)
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        error: 'MISSING_COORDINATES',
        message: 'GPS coordinates (latitude, longitude) are required',
      });
    }

    const lat = Number(latitude);
    const lon = Number(longitude);

    // 2. Coordinate range validation (§45)
    if (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) {
      return res.status(400).json({
        error: 'INVALID_COORDINATES',
        message: 'latitude and longitude must be valid finite numbers',
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: 'INVALID_COORDINATES',
        message: 'latitude must be -90 to 90, longitude must be -180 to 180',
      });
    }

    // 3. Check salon status (§42)
    const salon = await Salon.findById(req.salonId);
    if (!salon) {
      return res.status(404).json({ error: 'RESOURCE_NOT_FOUND', message: 'Salon not found' });
    }
    if (salon.status !== 'ACTIVE' && !salon.isActive) {
      return res.status(403).json({
        error: 'SALON_CLOSED',
        message: 'Salon is currently suspended or closed for operations',
      });
    }

    // 4. Check user status (§42)
    if (req.user.status !== 'ACTIVE' && !req.user.isActive) {
      return res.status(403).json({
        error: 'STAFF_INACTIVE',
        message: 'Your staff account is currently inactive',
      });
    }

    // 5. Check duplicate check-in protection (§43)
    const activeAttendance = await Attendance.findOne({
      salonId: req.salonId,
      staffUserId: req.user._id,
      status: 'CHECKED_IN',
    });

    if (activeAttendance) {
      return res.status(409).json({
        error: 'ATTENDANCE_ALREADY_ACTIVE',
        message: 'You are already checked in. Please check out first.',
        currentAttendance: activeAttendance._id,
      });
    }

    // 6. Haversine distance math (§47)
    const distance = haversineDistance(lat, lon, salon.latitude, salon.longitude);
    const roundedDistance = Math.round(distance);
    // Inclusive boundary test (distance <= allowedRadius per §47)
    const isWithinRadius = distance <= salon.allowedRadius;

    if (!isWithinRadius) {
      return res.status(403).json({
        error: 'OUT_OF_RANGE',
        message: `You are ${roundedDistance}m away from the salon. Allowed radius is ${salon.allowedRadius}m.`,
        distance: roundedDistance,
        allowedRadius: salon.allowedRadius,
      });
    }

    // 7. Record check-in
    const attendance = await Attendance.create({
      salonId: req.salonId,
      staffUserId: req.user._id,
      status: 'CHECKED_IN',
      checkInTime: new Date(),
      checkInLocation: { latitude: lat, longitude: lon },
      distanceFromSalon: roundedDistance,
      isWithinRadius: true,
    });

    logAudit(req, 'ATTENDANCE_CHECK_IN', 'Attendance', attendance._id, {
      distanceFromSalon: roundedDistance,
    });

    res.status(201).json({
      message: 'Check-in successful',
      attendance: {
        id: attendance._id,
        status: attendance.status,
        checkInTime: attendance.checkInTime,
        distanceFromSalon: attendance.distanceFromSalon,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Staff check-out endpoint (§44).
 */
const checkOut = async (req, res, next) => {
  try {
    const { latitude, longitude } = sanitizeFields(req.body, ['latitude', 'longitude']);

    const activeAttendance = await Attendance.findOne({
      salonId: req.salonId,
      staffUserId: req.user._id,
      status: 'CHECKED_IN',
    });

    if (!activeAttendance) {
      return res.status(409).json({
        error: 'NO_ACTIVE_ATTENDANCE',
        message: 'No active check-in session found to check out from',
      });
    }

    const now = new Date();
    activeAttendance.status = 'CHECKED_OUT';
    activeAttendance.checkOutTime = now;
    if (latitude != null && longitude != null) {
      activeAttendance.checkOutLocation = { latitude: Number(latitude), longitude: Number(longitude) };
    }

    await activeAttendance.save();

    logAudit(req, 'ATTENDANCE_CHECK_OUT', 'Attendance', activeAttendance._id, {
      checkInTime: activeAttendance.checkInTime,
      checkOutTime: now,
    });

    res.json({
      message: 'Check-out successful',
      attendance: activeAttendance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's attendance for current user (§41).
 */
const getTodayAttendance = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOne({
      salonId: req.salonId,
      staffUserId: req.user._id,
      checkInTime: { $gte: today, $lt: tomorrow },
    }).sort({ checkInTime: -1 });

    res.json({
      isCheckedIn: attendance?.status === 'CHECKED_IN',
      attendance: attendance || null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkIn, checkOut, getTodayAttendance };
