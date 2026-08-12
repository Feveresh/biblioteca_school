const pool = require('../config/db');
const { construirOrdenacao, construirPaginacao } = require('../utils/listagem');

const COLUNAS_ORDENACAO = ['nome', 'turma'];

// Listar alunos — busca, filtro por turma, ordenação e paginação
exports.listar = async (req, res) => {
  const { busca, turma, ordenarPor, ordem } = req.query;
  const condicoes = [];
  const valores = [];

  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`(nome ILIKE $${valores.length} OR turma ILIKE $${valores.length})`);
  }
  if (turma) {
    valores.push(turma);
    condicoes.push(`turma = $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const orderBy = construirOrdenacao(ordenarPor, ordem, COLUNAS_ORDENACAO, 'nome');
  const { pagina, porPagina, offset } = construirPaginacao(req.query);

  const { rows: totalRows } = await pool.query(`SELECT COUNT(*) FROM alunos ${where}`, valores);
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, offset];
  const { rows } = await pool.query(
    `SELECT * FROM alunos ${where} ORDER BY ${orderBy} LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}`,
    valoresPagina
  );

  res.json({ dados: rows, total, pagina, porPagina });
};

// GET /api/alunos/turmas — valores distintos de turma, para popular o filtro
exports.turmas = async (req, res) => {
  const { rows } = await pool.query(
    "SELECT DISTINCT turma FROM alunos WHERE turma IS NOT NULL AND turma <> '' ORDER BY turma"
  );
  res.json(rows.map(r => r.turma));
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
