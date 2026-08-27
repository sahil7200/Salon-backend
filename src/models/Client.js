const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  // Lifecycle status (§18)
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
  },
  // Legacy compat
  isActive: {
    type: Boolean,
    default: true,
  },
  notes: String,
}, { timestamps: true });

clientSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'ACTIVE';
  }
  next();
});

clientSchema.index({ salonId: 1, phone: 1 });
clientSchema.index({ salonId: 1, status: 1 });

module.exports = mongoose.model('Client', clientSchema);
