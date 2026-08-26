const express = require('express');
const router = express.Router();
const { createClient, getClients, getClientById } = require('../controllers/clientController');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const subscriptionGate = require('../middleware/subscriptionGate');

router.use(auth, subscriptionGate);

router.get('/', authorize('SALON_OWNER', 'RECEPTIONIST'), getClients);
router.get('/:id', authorize('SALON_OWNER', 'RECEPTIONIST'), getClientById);
router.post('/', authorize('SALON_OWNER', 'RECEPTIONIST'), createClient);

module.exports = router;
