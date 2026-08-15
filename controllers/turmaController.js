const pool = require('../config/db');

// GET /api/turmas — catálogo completo, ordenado alfabeticamente
exports.listar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM turmas ORDER BY nome');
  res.json(rows);
};

// POST /api/turmas — usado pelo botão "+ Adicionar nova turma" no formulário de aluno
exports.criar = async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Nome da turma é obrigatório' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO turmas (nome) VALUES ($1) RETURNING *',
      [nome.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Essa turma já existe' });
    }
    throw err;
  }
};

// DELETE /api/turmas/:id
exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM turmas WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Turma não encontrada' });
    res.json({ mensagem: 'Turma removida com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Turma está em uso por algum aluno e não pode ser removida' });
    }
    throw err;
  }
};
