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
    enum: ['Haircut', 'Facial', 'Hair Color'],
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

staffSchema.index({ salonId: 1 });

module.exports = mongoose.model('Staff', staffSchema);
