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
  // Geo-fencing configuration
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  allowedRadius: {
    type: Number,
    default: 100, // meters
    required: true,
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
    enum: ['ACTIVE', 'EXPIRED', 'NONE'],
    default: 'NONE',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Salon', salonSchema);
