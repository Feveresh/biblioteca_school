const router = require('express').Router();
const c = require('../controllers/emprestimoController');
const { autorizar } = require('../middleware/permissao');
const auditoria = require('../middleware/auditoria');

router.get('/',              c.listar);
router.get('/pendentes',     c.pendentes);
router.post('/',             autorizar('emprestimos.criar'),   auditoria('emprestimos'), c.criar);
router.patch('/:id/renovar', autorizar('emprestimos.renovar'), auditoria('emprestimos'), c.renovar);

module.exports = router;
