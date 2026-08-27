const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUserStatus } = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'SALON_OWNER'), getUsers);
router.post('/', authorize('SUPER_ADMIN', 'SALON_OWNER'), createUser);
router.patch('/:id/status', authorize('SUPER_ADMIN', 'SALON_OWNER'), updateUserStatus);

module.exports = router;
