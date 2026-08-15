const router = require('express').Router();
const c = require('../controllers/generoController');
const { autorizar } = require('../middleware/permissao');

router.get('/',      c.listar);
router.post('/',     autorizar('livros.editar'),  c.criar);
router.patch('/:id',  autorizar('livros.editar'),  c.atualizarCor);
router.delete('/:id', autorizar('livros.excluir'), c.remover);

module.exports = router;
