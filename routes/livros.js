const router = require('express').Router();
const c = require('../controllers/livroController');
const { autorizar } = require('../middleware/permissao');
const auditoria = require('../middleware/auditoria');

const auditar = auditoria('livros');

router.get('/',                    c.listar);
router.get('/estantes',            c.estantes);
router.get('/:id',                 c.buscar);
router.post('/',                   autorizar('livros.criar'),   auditar, c.criar);
router.put('/:id',                 autorizar('livros.editar'),  auditar, c.atualizar);
router.patch('/:id/disponibilidade', autorizar('livros.editar'), auditar, c.alternarDisponibilidade);
router.delete('/:id',              autorizar('livros.excluir'), auditar, c.remover);

module.exports = router;
