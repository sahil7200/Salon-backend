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

// View routes (All salon roles: Owner, Receptionist)
router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getAppointments);
router.get('/today-count', authorize('SALON_OWNER', 'RECEPTIONIST'), getTodayCount);
router.get('/:id', authorize('SALON_OWNER', 'RECEPTIONIST'), getAppointmentById);

// Write routes (Salon Owner ONLY - Receptionist has view-only access)
router.post('/', authorize('SALON_OWNER'), createAppointment);
router.patch('/:id/status', authorize('SALON_OWNER'), updateAppointmentStatus);

module.exports = router;
