const express = require('express');
const router = express.Router();
const { createPlan, getPlans, getPlanById, updatePlan } = require('../controllers/planController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

// All plan management is Super Admin only
router.use(auth, authorize('SUPER_ADMIN'));

router.post('/', createPlan);
router.get('/', getPlans);
router.get('/:id', getPlanById);
router.put('/:id', updatePlan);

module.exports = router;
