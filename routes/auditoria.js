const router = require('express').Router();
const c = require('../controllers/auditoriaController');

router.get('/', c.listar);

module.exports = router;
