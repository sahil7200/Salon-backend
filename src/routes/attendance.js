const express = require('express');
const router = express.Router();
const { checkIn, getTodayAttendance } = require('../controllers/attendanceController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

// Staff check-in with geo-fencing
router.post('/check-in', authorize('SALON_OWNER', 'RECEPTIONIST'), checkIn);

// Get today's attendance status
router.get('/today', authorize('SALON_OWNER', 'RECEPTIONIST'), getTodayAttendance);

module.exports = router;
