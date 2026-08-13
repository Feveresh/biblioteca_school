const router = require('express').Router();
const c = require('../controllers/estatisticaController');

router.get('/', c.resumo);

module.exports = router;
