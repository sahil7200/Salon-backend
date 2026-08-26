const Attendance = require('../models/Attendance');
const Salon = require('../models/Salon');
const { haversineDistance } = require('../utils/haversine');

/**
 * Staff check-in endpoint.
 * Calculates Haversine distance between staff location and salon.
 * Server-side distance math — NEVER trust a frontend inside/outside flag.
 */
const checkIn = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    // Handle missing coordinates gracefully, not with a crash
    if (latitude == null || longitude == null) {
      return res.status(400).json({
        error: 'MISSING_COORDINATES',
        message: 'GPS coordinates (latitude, longitude) are required',
      });
    }

    // Validate coordinate types
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        error: 'INVALID_COORDINATES',
        message: 'latitude and longitude must be valid numbers',
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: 'INVALID_COORDINATES',
        message: 'latitude must be -90 to 90, longitude must be -180 to 180',
      });
    }

    // Get salon location (server-side source of truth)
    const salon = await Salon.findById(req.salonId);
    if (!salon) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Salon not found' });
    }

    // Haversine distance calculation — runs server-side
    const distance = haversineDistance(lat, lon, salon.latitude, salon.longitude);
    const isWithinRadius = distance <= salon.allowedRadius;

    if (!isWithinRadius) {
      return res.status(403).json({
        error: 'OUT_OF_RANGE',
        message: `You are ${Math.round(distance)}m away from the salon. The allowed radius is ${salon.allowedRadius}m.`,
      });
    }

    // Record the check-in
    const attendance = await Attendance.create({
      salonId: req.salonId,
      staffUserId: req.user._id,
      checkInTime: new Date(),
      checkInLocation: { latitude: lat, longitude: lon },
      distanceFromSalon: Math.round(distance),
      isWithinRadius: true,
    });

    res.status(201).json({
      message: 'Check-in successful',
      attendance: {
        id: attendance._id,
        checkInTime: attendance.checkInTime,
        distanceFromSalon: attendance.distanceFromSalon,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's attendance for the current user
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
      isCheckedIn: !!attendance,
      attendance: attendance || null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkIn, getTodayAttendance };
