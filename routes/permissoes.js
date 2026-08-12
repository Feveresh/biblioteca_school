const router = require('express').Router();
const c = require('../controllers/permissaoController');

router.get('/', c.listar);

module.exports = router;
