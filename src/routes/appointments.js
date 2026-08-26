const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  getTodayCount,
} = require('../controllers/appointmentController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

// All roles (Owner, Receptionist) can view/create appointments
router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getAppointments);
router.get('/today-count', authorize('SALON_OWNER', 'RECEPTIONIST'), getTodayCount);
router.get('/:id', authorize('SALON_OWNER', 'RECEPTIONIST'), getAppointmentById);
router.post('/', authorize('SALON_OWNER', 'RECEPTIONIST'), createAppointment);
router.patch('/:id/status', authorize('SALON_OWNER', 'RECEPTIONIST'), updateAppointmentStatus);

module.exports = router;
