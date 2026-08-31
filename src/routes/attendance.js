const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getTodayAttendance, getSalonAttendanceList } = require('../controllers/attendanceController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

// Staff check-in with geo-fencing (§41-43)
router.post('/check-in', authorize('SALON_OWNER', 'RECEPTIONIST'), checkIn);

// Staff check-out (§44)
router.post('/check-out', authorize('SALON_OWNER', 'RECEPTIONIST'), checkOut);

// Get today's attendance status for current user (§41)
router.get('/today', authorize('SALON_OWNER', 'RECEPTIONIST'), getTodayAttendance);

// Get today's attendance records list for salon (Salon Owner / Receptionist / Super Admin)
router.get('/list', authorize('SALON_OWNER', 'RECEPTIONIST', 'SUPER_ADMIN'), getSalonAttendanceList);

module.exports = router;
