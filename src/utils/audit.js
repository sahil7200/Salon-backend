const AuditLog = require('../models/AuditLog');

/**
 * Write an immutable audit log entry (§49).
 * Fire-and-forget — audit failures must never block business operations.
 *
 * @param {Object} req - Express request (provides actor, salon, request context)
 * @param {string} action - e.g. 'APPOINTMENT_CREATED', 'ATTENDANCE_CHECK_IN'
 * @param {string} resourceType - e.g. 'Appointment', 'Staff'
 * @param {string|ObjectId} resourceId
 * @param {Object} [metadata] - action-specific data (never include passwords/secrets)
 */
const logAudit = (req, action, resourceType, resourceId, metadata = {}) => {
  AuditLog.create({
    actorId: req.user?._id,
    actorRole: req.user?.role,
    salonId: req.salonId,
    action,
    resourceType,
    resourceId,
    metadata,
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  }).catch((err) => {
    // Log the error but never throw — audit must not break business flow
    console.error('[AUDIT] Failed to write audit log:', err.message);
  });
};

module.exports = { logAudit };
