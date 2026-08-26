const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  durationInDays: {
    type: Number,
    required: true,
    min: 1,
  },
  maxStaff: {
    type: Number,
    required: true,
    min: 1,
  },
  maxAppointments: {
    type: Number,
    required: true,
    min: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
