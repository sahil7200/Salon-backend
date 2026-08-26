const mongoose = require('mongoose');

// Fixed service definitions - durations are fixed per requirements
const SERVICE_DURATIONS = {
  'Haircut': 30,
  'Facial': 60,
  'Hair Color': 120,
};

const appointmentSchema = new mongoose.Schema({
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  service: {
    type: String,
    enum: ['Haircut', 'Facial', 'Hair Color'],
    required: true,
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,
  },
  endTime: {
    type: String,
    required: true,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
    default: 'PENDING',
  },
}, { timestamps: true });

// Compound index for conflict detection queries
appointmentSchema.index({ salonId: 1, staff: 1, date: 1, status: 1 });
appointmentSchema.index({ salonId: 1, date: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.SERVICE_DURATIONS = SERVICE_DURATIONS;
