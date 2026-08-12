const router = require('express').Router();
const c = require('../controllers/devolucaoController');

router.patch('/:id/devolver', c.devolver);

module.exports = router;