const pool = require('../config/db');

// GET /api/permissoes — catálogo (usado para montar a UI de papéis)
exports.listar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM permissoes ORDER BY categoria, codigo');
  res.json(rows);
};
