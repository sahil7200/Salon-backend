const express = require('express');
const router = express.Router();
const { getServices, createService, deactivateService } = require('../controllers/serviceController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getServices);
router.post('/', authorize('SALON_OWNER'), createService);
router.patch('/:id/deactivate', authorize('SALON_OWNER'), deactivateService);

module.exports = router;
