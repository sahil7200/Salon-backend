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
  // Lifecycle status (§41)
  status: {
    type: String,
    enum: ['CHECKED_IN', 'CHECKED_OUT'],
    default: 'CHECKED_IN',
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
  // Check-out fields (§41, §44)
  checkOutTime: Date,
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
  },
}, { timestamps: true });

attendanceSchema.index({ salonId: 1, staffUserId: 1, checkInTime: -1 });
// Index for duplicate check-in queries (§43)
attendanceSchema.index({ salonId: 1, staffUserId: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
