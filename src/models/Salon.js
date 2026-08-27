const mongoose = require('mongoose');

const salonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  address: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  // Operational status (§8)
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
    default: 'ACTIVE',
  },
  // Geo-fencing configuration
  latitude: {
    type: Number,
    required: true,
    default: 19.0760,
  },
  longitude: {
    type: Number,
    required: true,
    default: 72.8777,
  },
  allowedRadius: {
    type: Number,
    default: 100, // meters
    required: true,
  },
  // Timezone for correct "today" logic (§62-63)
  timezone: {
    type: String,
    default: 'Asia/Kolkata',
  },
  // Working hours config
  openingTime: {
    type: String,
    default: '09:00',
  },
  closingTime: {
    type: String,
    default: '20:00',
  },
  // Subscription fields
  currentPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  subscriptionStatus: {
    type: String,
    enum: ['TRIAL', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'SUSPENDED', 'CANCELLED', 'NONE', 'PENDING_APPROVAL'],
    default: 'NONE',
  },
  pendingPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
  },
  pendingPlanRequestedAt: Date,
  // Legacy compat
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Keep isActive in sync with status
salonSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'ACTIVE';
  }
  next();
});

module.exports = mongoose.model('Salon', salonSchema);
