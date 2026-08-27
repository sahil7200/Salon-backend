const express = require('express');
const router = express.Router();
const { createStaff, getStaff, deactivateStaff } = require('../controllers/staffController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getStaff);
router.post('/', authorize('SALON_OWNER'), createStaff);
router.patch('/:id/deactivate', authorize('SALON_OWNER'), deactivateStaff);

module.exports = router;
