const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
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
  durationInMinutes: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

serviceSchema.index({ salonId: 1, name: 1 });

module.exports = mongoose.model('Service', serviceSchema);
