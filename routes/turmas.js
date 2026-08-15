const router = require('express').Router();
const c = require('../controllers/turmaController');
const { autorizar } = require('../middleware/permissao');

router.get('/',      c.listar);
router.post('/',     autorizar('alunos.editar'),  c.criar);
router.delete('/:id', autorizar('alunos.excluir'), c.remover);

module.exports = router;
