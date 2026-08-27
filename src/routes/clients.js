const express = require('express');
const router = express.Router();
const { createClient, getClients, getClientById, deactivateClient } = require('../controllers/clientController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

// View routes (Owner, Receptionist)
router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getClients);
router.get('/:id', authorize('SALON_OWNER', 'RECEPTIONIST'), getClientById);

// Write routes (Salon Owner ONLY - Receptionist has view-only access)
router.post('/', authorize('SALON_OWNER'), createClient);
router.patch('/:id/deactivate', authorize('SALON_OWNER'), deactivateClient);

module.exports = router;
