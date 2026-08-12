const router = require('express').Router();
const c = require('../controllers/emprestimoController');

router.get('/',          c.listar);
router.get('/pendentes', c.pendentes);
router.post('/',         c.criar);

module.exports = router;