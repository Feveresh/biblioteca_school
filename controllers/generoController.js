const pool = require('../config/db');

// GET /api/generos — catálogo completo, ordenado alfabeticamente
exports.listar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM generos ORDER BY nome');
  res.json(rows);
};

// POST /api/generos — usado pelo botão "+ Adicionar novo gênero" no formulário de livro
exports.criar = async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Nome do gênero é obrigatório' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO generos (nome) VALUES ($1) RETURNING *',
      [nome.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Esse gênero já existe' });
    }
    throw err;
  }
};
