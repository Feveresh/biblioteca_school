const pool = require('../config/db');

// Listar alunos (com busca opcional por nome/turma)
exports.listar = async (req, res) => {
  const { busca } = req.query;
  const condicoes = [];
  const valores = [];

  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`(nome ILIKE $${valores.length} OR turma ILIKE $${valores.length})`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM alunos ${where} ORDER BY nome`, valores);
  res.json(rows);
};

exports.buscar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM alunos WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Aluno não encontrado' });
  res.json(rows[0]);
};

exports.criar = async (req, res) => {
  const { nome, turma } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const { rows } = await pool.query(
    'INSERT INTO alunos (nome, turma) VALUES ($1, $2) RETURNING *',
    [nome, turma]
  );
  res.status(201).json(rows[0]);
};

exports.atualizar = async (req, res) => {
  const { nome, turma } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const { rows } = await pool.query(
    'UPDATE alunos SET nome=$1, turma=$2 WHERE id=$3 RETURNING *',
    [nome, turma, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Aluno não encontrado' });
  res.json(rows[0]);
};

exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM alunos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json({ mensagem: 'Aluno removido com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Aluno possui empréstimos vinculados e não pode ser removido' });
    }
    throw err;
  }
};
