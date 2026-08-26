const express = require('express');
const router = express.Router();
const { getServices } = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

// Get services for salon
router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getServices);

module.exports = router;
