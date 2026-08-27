const express = require('express');
const router = express.Router();
const {
  getSalons,
  getSalonById,
  createSalon,
  updateSalon,
  assignPlan,
  updateSalonStatus,
  getSubscriptionHistory,
} = require('../controllers/salonController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(auth);

// List salons - all authenticated users can view (filtered by role in controller)
router.get('/', getSalons);

// Create salon - Super Admin only
router.post('/', authorize('SUPER_ADMIN'), createSalon);

// Update salon details / coordinates - Super Admin or Salon Owner
router.patch('/:id', updateSalon);

// Get salon by ID
router.get('/:id', getSalonById);

// Assign/renew plan - Super Admin only
router.post('/assign-plan', authorize('SUPER_ADMIN'), assignPlan);

// Update salon operational status (ACTIVE/SUSPENDED/CLOSED) - Super Admin only (§8)
router.patch('/:id/status', authorize('SUPER_ADMIN'), updateSalonStatus);

// Subscription history - Super Admin sees all, salon users see their own
router.get('/subscriptions/history', getSubscriptionHistory);

module.exports = router;
