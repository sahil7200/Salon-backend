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
  previousPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
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
    enum: ['ASSIGN', 'RENEW', 'UPGRADE', 'DOWNGRADE', 'EXPIRE', 'SUSPEND', 'CANCEL'],
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

subscriptionHistorySchema.index({ salonId: 1, createdAt: -1 });

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
