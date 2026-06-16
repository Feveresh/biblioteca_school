const pool = require('../config/db');

// Listar todos os livros
exports.listar = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM livros ORDER BY titulo'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// Buscar livro por ID
exports.buscar = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM livros WHERE id = $1', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
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
    res.status(500).json({ erro: err.message });
  }
};

// Atualizar livro
exports.atualizar = async (req, res) => {
  const { tombo, titulo, autor } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE livros SET tombo=$1, titulo=$2, autor=$3
       WHERE id=$4 RETURNING *`,
      [tombo, titulo, autor, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// Remover livro
exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM livros WHERE id = $1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json({ mensagem: 'Livro removido com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};