const pool = require('../config/db');
const { diasAtras } = require('../utils/dataAtras');

// Limpeza "oportunista": sem timer (o processo pode rodar serverless e não sobreviver
// entre invocações) — dispara no máximo 1x por dia, na primeira consulta à tela de auditoria.
async function limpezaOportunista() {
  const { rows } = await pool.query(
    'SELECT auditoria_retencao_dias, auditoria_ultima_limpeza FROM configuracoes WHERE id = 1'
  );
  const cfg = rows[0];
  if (!cfg) return;

  const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (cfg.auditoria_ultima_limpeza && new Date(cfg.auditoria_ultima_limpeza) > umDiaAtras) return;

  await pool.query(
    `DELETE FROM log_auditoria WHERE criado_em < ${diasAtras('$1')}`,
    [cfg.auditoria_retencao_dias]
  );
  await pool.query('UPDATE configuracoes SET auditoria_ultima_limpeza = CURRENT_TIMESTAMP WHERE id = 1');
}

// GET /api/auditoria?entidade=&usuario_id=&acao=&de=&ate=&pagina=&porPagina=
exports.listar = async (req, res) => {
  limpezaOportunista().catch(err => console.error('Falha na limpeza de auditoria:', err.message));

  const { entidade, usuario_id, acao, de, ate } = req.query;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(req.query.porPagina) || 30));

  const condicoes = [];
  const valores = [];

  if (entidade)   { valores.push(entidade);   condicoes.push(`entidade = $${valores.length}`); }
  if (usuario_id) { valores.push(usuario_id); condicoes.push(`usuario_id = $${valores.length}`); }
  if (acao)       { valores.push(acao);       condicoes.push(`acao = $${valores.length}`); }
  if (de)         { valores.push(de);         condicoes.push(`criado_em >= $${valores.length}`); }
  if (ate)        { valores.push(ate);        condicoes.push(`criado_em <= $${valores.length}`); }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  const { rows: totalRows } = await pool.query(`SELECT COUNT(*) FROM log_auditoria ${where}`, valores);
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, (pagina - 1) * porPagina];
  const { rows } = await pool.query(`
    SELECT l.*, u.nome AS usuario_nome, u.email AS usuario_email
    FROM log_auditoria l
    LEFT JOIN users u ON u.id = l.usuario_id
    ${where}
    ORDER BY l.criado_em DESC
    LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}
  `, valoresPagina);

  // Postgres (JSONB) já devolve dados_antes/dados_depois como objeto; SQLite (coluna TEXT)
  // devolve a string crua gravada por utils/auditoria.js — precisa desserializar aqui.
  if (pool.usaSqlite) {
    for (const linha of rows) {
      if (typeof linha.dados_antes === 'string') linha.dados_antes = JSON.parse(linha.dados_antes);
      if (typeof linha.dados_depois === 'string') linha.dados_depois = JSON.parse(linha.dados_depois);
    }
  }

  res.json({ dados: rows, total, pagina, porPagina });
};
