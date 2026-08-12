const pool = require('../config/db');
const { construirOrdenacao, construirPaginacao } = require('../utils/listagem');

const COLUNAS_ORDENACAO = ['titulo', 'autor', 'tombo', 'disponivel', 'estante'];

// Listar livros — busca, filtros, ordenação e paginação
exports.listar = async (req, res) => {
  const { busca, disponivel, estante, ordenarPor, ordem } = req.query;
  const condicoes = [];
  const valores = [];

  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`(titulo ILIKE $${valores.length} OR autor ILIKE $${valores.length} OR tombo ILIKE $${valores.length})`);
  }
  if (disponivel === 'true' || disponivel === 'false') {
    valores.push(disponivel === 'true');
    condicoes.push(`disponivel = $${valores.length}`);
  }
  if (estante) {
    valores.push(estante);
    condicoes.push(`estante = $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const orderBy = construirOrdenacao(ordenarPor, ordem, COLUNAS_ORDENACAO, 'titulo');
  const { pagina, porPagina, offset } = construirPaginacao(req.query);

  const { rows: totalRows } = await pool.query(`SELECT COUNT(*) FROM livros ${where}`, valores);
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, offset];
  const { rows } = await pool.query(
    `SELECT * FROM livros ${where} ORDER BY ${orderBy} LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}`,
    valoresPagina
  );

  res.json({ dados: rows, total, pagina, porPagina });
};

// Buscar livro por ID
exports.buscar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM livros WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
  res.json(rows[0]);
};

// Cadastrar livro
exports.criar = async (req, res) => {
  const { tombo, titulo, autor, estante, prateleira } = req.body;
  if (!tombo || !titulo) {
    return res.status(400).json({ erro: 'Tombo e título são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO livros (tombo, titulo, autor, estante, prateleira) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tombo, titulo, autor, estante || null, prateleira || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Tombo já cadastrado' });
    }
    throw err;
  }
};

// Atualizar livro
exports.atualizar = async (req, res) => {
  const { tombo, titulo, autor, estante, prateleira } = req.body;
  if (!tombo || !titulo) {
    return res.status(400).json({ erro: 'Tombo e título são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE livros SET tombo=$1, titulo=$2, autor=$3, estante=$4, prateleira=$5
       WHERE id=$6 RETURNING *`,
      [tombo, titulo, autor, estante || null, prateleira || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Tombo já cadastrado' });
    }
    throw err;
  }
};

// Remover livro
exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM livros WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json({ mensagem: 'Livro removido com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Livro possui empréstimos vinculados e não pode ser removido' });
    }
    throw err;
  }
};
