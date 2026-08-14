const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const SELECT_USUARIO = `
  SELECT u.id, u.nome, u.email, u.ativo, u.created_at, r.id AS papel_id, r.nome AS papel_nome
  FROM users u
  JOIN roles r ON r.id = u.role_id
`;

exports.listar = async (req, res) => {
  const { rows } = await pool.query(`${SELECT_USUARIO} ORDER BY u.nome`);
  res.json(rows);
};

exports.buscar = async (req, res) => {
  const { rows } = await pool.query(`${SELECT_USUARIO} WHERE u.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.json(rows[0]);
};

exports.criar = async (req, res) => {
  const { nome, email, senha, role_id } = req.body;
  if (!nome || !email || !senha || !role_id) {
    return res.status(400).json({ erro: 'Nome, email, senha e papel são obrigatórios' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
  }
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (nome, email, senha_hash, role_id) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, ativo, role_id, created_at',
      [nome, email, senhaHash, role_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Email já cadastrado' });
    if (err.code === '23503') return res.status(400).json({ erro: 'Papel informado não existe' });
    throw err;
  }
};

exports.atualizar = async (req, res) => {
  const { nome, email, role_id } = req.body;
  if (!nome || !email || !role_id) {
    return res.status(400).json({ erro: 'Nome, email e papel são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE users SET nome=$1, email=$2, role_id=$3 WHERE id=$4 RETURNING id, nome, email, ativo, role_id, created_at',
      [nome, email, role_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Email já cadastrado' });
    if (err.code === '23503') return res.status(400).json({ erro: 'Papel informado não existe' });
    throw err;
  }
};

// PATCH /api/usuarios/:id/status  { ativo: boolean }
exports.atualizarStatus = async (req, res) => {
  const { ativo } = req.body;
  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "ativo" (verdadeiro/falso) é obrigatório' });
  }
  if (req.usuario.id === Number(req.params.id)) {
    return res.status(400).json({ erro: 'Você não pode desativar sua própria conta' });
  }
  const { rows } = await pool.query(
    'UPDATE users SET ativo=$1 WHERE id=$2 RETURNING id, nome, email, ativo',
    [ativo, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.locals.auditAcao = ativo ? 'ativar' : 'desativar';
  res.json(rows[0]);
};

// POST /api/usuarios/:id/senha  { senha }
exports.redefinirSenha = async (req, res) => {
  const { senha } = req.body;
  if (!senha || senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  // Redefinir senha também revoga sessões ativas desse usuário (mesmo mecanismo do logout).
  const { rowCount } = await pool.query(
    'UPDATE users SET senha_hash=$1, tokens_validos_apos = CURRENT_TIMESTAMP WHERE id=$2',
    [senhaHash, req.params.id]
  );
  if (!rowCount) return res.status(404).json({ erro: 'Usuário não encontrado' });
  res.locals.auditAcao = 'redefinir_senha';
  res.locals.auditEntidadeId = Number(req.params.id);
  res.json({ mensagem: 'Senha redefinida com sucesso' });
};
