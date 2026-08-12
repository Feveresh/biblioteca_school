const pool = require('../config/db');

// Listar livros (com busca e filtro por disponibilidade opcionais)
exports.listar = async (req, res) => {
  const { busca, disponivel } = req.query;
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

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM livros ${where} ORDER BY titulo`, valores);
  res.json(rows);
};

// Buscar livro por ID
exports.buscar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM livros WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
  res.json(rows[0]);
};

// Cadastrar livro
exports.criar = async (req, res) => {
  const { tombo, titulo, autor } = req.body;
  if (!tombo || !titulo) {
    return res.status(400).json({ erro: 'Tombo e título são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO livros (tombo, titulo, autor) VALUES ($1, $2, $3) RETURNING *',
      [tombo, titulo, autor]
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
  const { tombo, titulo, autor } = req.body;
  if (!tombo || !titulo) {
    return res.status(400).json({ erro: 'Tombo e título são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE livros SET tombo=$1, titulo=$2, autor=$3
       WHERE id=$4 RETURNING *`,
      [tombo, titulo, autor, req.params.id]
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
