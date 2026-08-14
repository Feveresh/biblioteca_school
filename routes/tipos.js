const router = require('express').Router();
const c = require('../controllers/tipoController');
const { autorizar } = require('../middleware/permissao');

router.get('/',  c.listar);
router.post('/', autorizar('livros.editar'), c.criar);

module.exports = router;
