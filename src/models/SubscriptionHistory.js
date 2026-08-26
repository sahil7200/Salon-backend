const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema({
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  action: {
    type: String,
    enum: ['ASSIGN', 'RENEW', 'UPGRADE'],
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
