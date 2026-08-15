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

// DELETE /api/tipos/:id
exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tipos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Tipo não encontrado' });
    res.json({ mensagem: 'Tipo removido com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Tipo está em uso por algum item e não pode ser removido' });
    }
    throw err;
  }
};
