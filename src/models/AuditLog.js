const mongoose = require('mongoose');

/**
 * Immutable audit trail (§49-50).
 * Append-only — never update or delete audit records.
 */
const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  actorRole: String,
  salonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  resourceType: {
    type: String, // e.g. 'Appointment', 'Staff', 'Attendance'
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // flexible JSON for action-specific data
  },
  requestId: String,
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

auditLogSchema.index({ salonId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
