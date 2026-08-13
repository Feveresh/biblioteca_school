const router = require('express').Router();
const c = require('../controllers/alunoController');
const { autorizar } = require('../middleware/permissao');
const auditoria = require('../middleware/auditoria');

const auditar = auditoria('alunos');

router.get('/',       c.listar);
router.get('/:id',    c.buscar);
router.post('/',      autorizar('alunos.criar'),   auditar, c.criar);
router.put('/:id',    autorizar('alunos.editar'),  auditar, c.atualizar);
router.delete('/:id', autorizar('alunos.excluir'), auditar, c.remover);

module.exports = router;
