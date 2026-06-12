const router = require('express').Router();
const { login, me, logout } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/login', login);
router.post('/logout', logout); // 🍪 Añadido para limpiar la cookie
router.get('/me', authMiddleware, me);

module.exports = router;
