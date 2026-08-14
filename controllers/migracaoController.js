const pool = require('../config/db');
const { testarConexao, copiarDados, finalizarMigracao } = require('../utils/migrarParaPostgres');
const migrarParaSqlite = require('../utils/migrarParaSqlite');
const { registrar: registrarAuditoria } = require('../utils/auditoria');

const REGEX_CONNECTION_STRING = /^postgres(ql)?:\/\//;

function validarCorpo(req, res) {
  const { connectionString } = req.body;
  if (typeof connectionString !== 'string' || !REGEX_CONNECTION_STRING.test(connectionString.trim())) {
    res.status(400).json({ erro: 'Informe uma URL de conexão PostgreSQL válida (postgresql://usuario:senha@host:porta/banco)' });
    return null;
  }
  if (!pool.usaSqlite) {
    res.status(400).json({ erro: 'O sistema já está usando PostgreSQL — não há o que migrar.' });
    return null;
  }
  return connectionString.trim();
}

// POST /api/migracao/testar — só verifica se dá pra conectar, não muda nada em nenhum banco.
exports.testar = async (req, res) => {
  const connectionString = validarCorpo(req, res);
  if (!connectionString) return;
  try {
    await testarConexao(connectionString);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ erro: `Não consegui conectar: ${err.message}` });
  }
};

// POST /api/migracao/copiar — copia tudo pro PostgreSQL de destino. Não apaga nada do SQLite
// nem muda a configuração do sistema — só depois de ver o relatório aqui é que a tela deixa
// confirmar o passo final (irreversível).
exports.copiar = async (req, res) => {
  const connectionString = validarCorpo(req, res);
  if (!connectionString) return;
  try {
    const relatorio = await copiarDados(connectionString);
    res.json({ relatorio });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

// POST /api/migracao/finalizar — ponto sem volta: reconfere a cópia, esvazia o SQLite
// (com backup de segurança antes) e aponta o .env pro PostgreSQL. Precisa reiniciar o
// sistema depois pra passar a valer.
exports.finalizar = async (req, res) => {
  const connectionString = validarCorpo(req, res);
  if (!connectionString) return;
  try {
    const resultado = await finalizarMigracao(connectionString);

    registrarAuditoria({
      usuarioId: req.usuario.id,
      entidade: 'sistema',
      entidadeId: null,
      acao: 'migrar_postgres',
      dadosAntes: null,
      dadosDepois: { relatorio: resultado.relatorio, backupSqlite: resultado.backupSqlite },
      ip: req.ip,
      metodoHttp: req.method,
      rota: req.originalUrl,
    }).catch(err => console.error('Falha ao registrar auditoria:', err.message));

    res.json({
      mensagem: 'Migração concluída. Reinicie o sistema para passar a usar o PostgreSQL.',
      backupSqlite: resultado.backupSqlite,
      relatorio: resultado.relatorio,
    });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

// ---------- Sentido contrário: PostgreSQL → SQLite ----------

// POST /api/migracao/sqlite/copiar — copia tudo pro arquivo SQLite padrão. Não muda o .env
// nem mexe no PostgreSQL — só depois de ver o relatório aqui é que a tela deixa confirmar
// o passo final.
exports.copiarParaSqlite = async (req, res) => {
  try {
    const relatorio = await migrarParaSqlite.copiarDados();
    res.json({ relatorio });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

// POST /api/migracao/sqlite/finalizar — reconfere a cópia e aponta o .env pro SQLite.
// Diferente do sentido contrário, NÃO apaga nada do PostgreSQL (servidor compartilhado,
// não um arquivo local descartável) — continua intacto, disponível caso precise voltar.
exports.finalizarParaSqlite = async (req, res) => {
  try {
    const resultado = await migrarParaSqlite.finalizarMigracao();

    registrarAuditoria({
      usuarioId: req.usuario.id,
      entidade: 'sistema',
      entidadeId: null,
      acao: 'migrar_sqlite',
      dadosAntes: null,
      dadosDepois: { relatorio: resultado.relatorio, caminhoSqlite: resultado.caminhoSqlite },
      ip: req.ip,
      metodoHttp: req.method,
      rota: req.originalUrl,
    }).catch(err => console.error('Falha ao registrar auditoria:', err.message));

    res.json({
      mensagem: 'Migração concluída. Reinicie o sistema para passar a usar o SQLite.',
      caminhoSqlite: resultado.caminhoSqlite,
      relatorio: resultado.relatorio,
    });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};
