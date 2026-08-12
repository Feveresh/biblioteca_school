const router = require('express').Router();
const c = require('../controllers/authController');
const autenticar = require('../middleware/auth');

router.post('/login', c.login);
router.post('/registrar', autenticar, c.registrar);
router.get('/me', autenticar, c.me);

module.exports = router;
