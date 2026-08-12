const router = require('express').Router();
const c = require('../controllers/usuarioController');
const auditoria = require('../middleware/auditoria');

const auditar = auditoria('usuarios');

router.get('/',             c.listar);
router.get('/:id',          c.buscar);
router.post('/',            auditar, c.criar);
router.put('/:id',          auditar, c.atualizar);
router.patch('/:id/status', auditar, c.atualizarStatus);
router.post('/:id/senha',   auditar, c.redefinirSenha);

module.exports = router;
