const pool = require('../config/db');

// GET /api/identidade-visual — público (a tela de login precisa saber a cor/nome antes de autenticar).
// Só devolve campos de marca — nunca limiares de segurança (login_max_tentativas etc.).
exports.buscar = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT nome_biblioteca, cor_primaria, logo_data_url FROM configuracoes WHERE id = 1'
  );
  res.json(rows[0]);
};
