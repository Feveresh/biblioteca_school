const router = require('express').Router();
const c = require('../controllers/configuracaoController');
const { autorizar } = require('../middleware/permissao');
const auditoria = require('../middleware/auditoria');

router.get('/', c.buscar);
router.put('/', autorizar('configuracoes.gerenciar'), auditoria('configuracoes'), c.atualizar);

module.exports = router;
