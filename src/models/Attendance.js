const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: true,
  },
  staffUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  checkInTime: {
    type: Date,
    default: Date.now,
  },
  checkInLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  distanceFromSalon: {
    type: Number, // in meters
  },
  isWithinRadius: {
    type: Boolean,
    required: true,
  },
}, { timestamps: true });

attendanceSchema.index({ salonId: 1, staffUserId: 1, checkInTime: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
