const router = require('express').Router();
const c = require('../controllers/atualizacaoController');
const autenticar = require('../middleware/auth');
const { autorizar } = require('../middleware/permissao');

// Sem autenticar — precisa responder mesmo numa aba que ainda não logou.
router.get('/status', c.status);

router.get('/verificar', autenticar, c.verificar);
router.post('/iniciar', autenticar, autorizar('configuracoes.gerenciar'), c.iniciar);
router.post('/limpar-erro', autenticar, autorizar('configuracoes.gerenciar'), c.limparErro);

module.exports = router;
