const pool = require('../config/db');

// GET /api/tipos — catálogo completo, ordenado alfabeticamente
exports.listar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tipos ORDER BY nome');
  res.json(rows);
};

// POST /api/tipos — usado pelo botão "+ Adicionar novo tipo" no formulário de item
exports.criar = async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Nome do tipo é obrigatório' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO tipos (nome) VALUES ($1) RETURNING *',
      [nome.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Esse tipo já existe' });
    }
    throw err;
  }
};
