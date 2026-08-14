const router = require('express').Router();
const c = require('../controllers/migracaoController');
const { autorizar } = require('../middleware/permissao');

router.post('/testar', autorizar('configuracoes.gerenciar'), c.testar);
router.post('/copiar', autorizar('configuracoes.gerenciar'), c.copiar);
router.post('/finalizar', autorizar('configuracoes.gerenciar'), c.finalizar);

router.post('/sqlite/copiar', autorizar('configuracoes.gerenciar'), c.copiarParaSqlite);
router.post('/sqlite/finalizar', autorizar('configuracoes.gerenciar'), c.finalizarParaSqlite);

module.exports = router;
