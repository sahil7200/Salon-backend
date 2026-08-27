const express = require('express');
const router = express.Router();
const { checkIn, checkOut, getTodayAttendance } = require('../controllers/attendanceController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

// Staff check-in with geo-fencing (§41-43)
router.post('/check-in', authorize('SALON_OWNER', 'RECEPTIONIST'), checkIn);

// Staff check-out (§44)
router.post('/check-out', authorize('SALON_OWNER', 'RECEPTIONIST'), checkOut);

// Get today's attendance status (§41)
router.get('/today', authorize('SALON_OWNER', 'RECEPTIONIST'), getTodayAttendance);

module.exports = router;
