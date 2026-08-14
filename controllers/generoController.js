const pool = require('../config/db');

const REGEX_COR = /^#[0-9a-fA-F]{6}$/;

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

// PATCH /api/generos/:id — só a cor (usada como fundo do badge de gênero na listagem de
// itens); "cor: null" limpa, voltando pro badge neutro padrão.
exports.atualizarCor = async (req, res) => {
  const { cor } = req.body;
  if (cor !== null && !REGEX_COR.test(cor || '')) {
    return res.status(400).json({ erro: 'Cor inválida (use o formato #RRGGBB)' });
  }
  const { rows } = await pool.query(
    'UPDATE generos SET cor = $1 WHERE id = $2 RETURNING *',
    [cor, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Gênero não encontrado' });
  res.json(rows[0]);
};
