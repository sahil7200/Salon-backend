const mongoose = require('mongoose');

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
  // Reference to Service model (§20)
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  },
  // Snapshot fields — frozen at booking time so price/name changes don't rewrite history (§21)
  serviceNameSnapshot: {
    type: String,
    required: true,
  },
  serviceDurationSnapshot: {
    type: Number, // minutes
    required: true,
  },
  servicePriceSnapshot: {
    type: Number, // price at time of booking
    default: 0,
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
  // Expanded state machine (§22-23)
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    default: 'PENDING',
  },
  // Cancellation metadata (§36)
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  cancellationReason: String,
  // Notes (allowed on completed appointments, §35)
  notes: String,
  // Optimistic concurrency version (§53)
  version: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Increment version on every save
appointmentSchema.pre('save', function (next) {
  if (!this.isNew) {
    this.version += 1;
  }
  next();
});

// Compound indexes for conflict detection and tenant queries
appointmentSchema.index({ salonId: 1, staff: 1, date: 1, status: 1 });
appointmentSchema.index({ salonId: 1, date: 1, status: 1 });
appointmentSchema.index({ salonId: 1, client: 1 });

// Valid state transitions (§23)
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],   // terminal state
  CANCELLED: [],   // terminal state
  NO_SHOW: [],     // terminal state — set by system/admin
};

// Statuses that block staff availability (§33)
const ACTIVE_APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.VALID_TRANSITIONS = VALID_TRANSITIONS;
module.exports.ACTIVE_APPOINTMENT_STATUSES = ACTIVE_APPOINTMENT_STATUSES;
