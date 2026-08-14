const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { buscarUsuarioAutenticado, formatarUsuario } = require('../utils/usuarioAuth');
const { registrar: registrarAuditoria } = require('../utils/auditoria');
const { minutosAtras } = require('../utils/dataAtras');

const TOKEN_EXPIRA_EM = '8h';

function gerarToken(usuarioId, lembrar) {
  // `emitidoEm` em milissegundos (não o `iat` padrão, que só tem precisão de segundo) —
  // evita ambiguidade ao comparar com `tokens_validos_apos` na revogação de sessão
  // (ver middleware/auth.js), que precisa de precisão sub-segundo pra ser confiável
  // logo após um login ou logout (users criados e autenticados quase ao mesmo tempo).
  // Com "lembrar" marcado, o token não leva `exp` — vale pra sempre (sobrevive a reinícios
  // do servidor, já que é o mesmo JWT_SECRET), até um logout explícito revogar via
  // tokens_validos_apos.
  const opcoes = lembrar ? {} : { expiresIn: TOKEN_EXPIRA_EM };
  return jwt.sign({ id: usuarioId, emitidoEm: Date.now() }, process.env.JWT_SECRET, opcoes);
}

async function registrarTentativaLogin(email, sucesso) {
  await pool.query('INSERT INTO login_tentativas (email, sucesso) VALUES ($1, $2)', [email, sucesso]);
}

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, senha, lembrar } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  const { rows: cfgRows } = await pool.query(
    'SELECT login_max_tentativas, login_bloqueio_minutos FROM configuracoes WHERE id = 1'
  );
  const { login_max_tentativas: maxTentativas, login_bloqueio_minutos: bloqueioMinutos } = cfgRows[0];

  const { rows: falhasRows } = await pool.query(
    `SELECT COUNT(*) as count FROM login_tentativas
     WHERE email = $1 AND sucesso = false AND criado_em > ${minutosAtras('$2')}`,
    [email, bloqueioMinutos]
  );
  if (Number(falhasRows[0].count) >= maxTentativas) {
    return res.status(429).json({
      erro: `Muitas tentativas de login. Tente novamente em até ${bloqueioMinutos} minuto(s).`,
    });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const usuario = rows[0];

  if (!usuario || !usuario.ativo) {
    await registrarTentativaLogin(email, false);
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) {
    await registrarTentativaLogin(email, false);
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  await registrarTentativaLogin(email, true);

  const usuarioCompleto = await buscarUsuarioAutenticado(usuario.id);
  const token = gerarToken(usuario.id, !!lembrar);

  registrarAuditoria({
    usuarioId: usuario.id, entidade: 'auth', entidadeId: usuario.id, acao: 'login',
    ip: req.ip, metodoHttp: req.method, rota: req.originalUrl,
  }).catch(err => console.error('Falha ao registrar auditoria:', err.message));

  res.json({ token, usuario: formatarUsuario(usuarioCompleto) });
};

// POST /api/auth/logout — revoga todos os tokens emitidos até agora para este usuário
exports.logout = async (req, res) => {
  await pool.query('UPDATE users SET tokens_validos_apos = CURRENT_TIMESTAMP WHERE id = $1', [req.usuario.id]);

  registrarAuditoria({
    usuarioId: req.usuario.id, entidade: 'auth', entidadeId: req.usuario.id, acao: 'logout',
    ip: req.ip, metodoHttp: req.method, rota: req.originalUrl,
  }).catch(err => console.error('Falha ao registrar auditoria:', err.message));

  res.json({ mensagem: 'Sessão encerrada' });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json(req.usuario);
};
