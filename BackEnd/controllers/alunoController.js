const pool = require('../config/db');

exports.listar = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM alunos ORDER BY nome');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

exports.buscar = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alunos WHERE id = $1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

exports.criar = async (req, res) => {
  const { nome, turma } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO alunos (nome, turma) VALUES ($1, $2) RETURNING *',
      [nome, turma]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

exports.atualizar = async (req, res) => {
  const { nome, turma } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE alunos SET nome=$1, turma=$2 WHERE id=$3 RETURNING *',
      [nome, turma, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM alunos WHERE id = $1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json({ mensagem: 'Aluno removido com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};