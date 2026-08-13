const pool = require('../config/db');

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Lê a configuração a cada requisição (sem cache) — mesmo padrão já usado pra permissões
// e revogação de sessão: o custo de uma consulta extra é aceitável pra garantir que
// ligar/desligar o acesso pela rede em Configurações tenha efeito imediato, sem reiniciar
// o serviço. Roda antes de tudo (inclusive dos arquivos estáticos), pra que a tela de
// login nem carregue de fora quando o acesso pela rede estiver desligado.
module.exports = async function somenteLocal(req, res, next) {
  const remoto = req.socket.remoteAddress;
  if (LOOPBACK.has(remoto)) return next();

  try {
    const { rows } = await pool.query('SELECT permitir_acesso_rede FROM configuracoes WHERE id = 1');
    if (rows[0]?.permitir_acesso_rede) return next();
  } catch (err) {
    return next(err);
  }

  res.status(403).json({ erro: 'Acesso pela rede desativado. Ative em Configurações → Administração, ou acesse por este computador.' });
};
