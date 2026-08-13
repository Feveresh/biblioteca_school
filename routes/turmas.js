const router = require('express').Router();
const c = require('../controllers/turmaController');
const { autorizar } = require('../middleware/permissao');

router.get('/',  c.listar);
router.post('/', autorizar('alunos.editar'), c.criar);

module.exports = router;
