const express = require('express');
const router = express.Router();
const {
  getSalons,
  getSalonById,
  assignPlan,
  getSubscriptionHistory,
} = require('../controllers/salonController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth);

// List salons - all authenticated users can view (filtered by role in controller)
router.get('/', getSalons);

// Get salon by ID
router.get('/:id', getSalonById);

// Assign/renew plan - Super Admin only
router.post('/assign-plan', authorize('SUPER_ADMIN'), assignPlan);

// Subscription history - Super Admin sees all, salon users see their own
router.get('/subscriptions/history', getSubscriptionHistory);

module.exports = router;
