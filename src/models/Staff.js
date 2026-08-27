const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
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
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  services: [{
    type: String,
  }],
  // Lifecycle status (§15)
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'ACTIVE',
  },
  // Legacy compat
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

staffSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.isActive = this.status === 'ACTIVE';
  }
  next();
});

staffSchema.index({ salonId: 1 });
staffSchema.index({ salonId: 1, phone: 1 });

module.exports = mongoose.model('Staff', staffSchema);
