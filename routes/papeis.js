const router = require('express').Router();
const c = require('../controllers/papelController');
const auditoria = require('../middleware/auditoria');

const auditar = auditoria('papeis');

router.get('/',       c.listar);
router.get('/:id',    c.buscar);
router.post('/',      auditar, c.criar);
router.put('/:id',    auditar, c.atualizar);
router.delete('/:id', auditar, c.remover);

module.exports = router;
