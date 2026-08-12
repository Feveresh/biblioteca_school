const router = require('express').Router();
const c = require('../controllers/identidadeVisualController');

router.get('/', c.buscar);

module.exports = router;
