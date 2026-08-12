const pool = require('../config/db');

const CAMPOS_SENSIVEIS = ['senha', 'senha_hash', 'token'];

// Mantém a chave visível no log (quem revisa sabe que o campo existia), só oculta o valor.
function sanitizar(dados) {
  if (!dados || typeof dados !== 'object') return dados;
  const copia = { ...dados };
  for (const campo of CAMPOS_SENSIVEIS) {
    if (campo in copia) copia[campo] = '[REDACTED]';
  }
  return copia;
}

async function registrar({ usuarioId, entidade, entidadeId, acao, dadosAntes, dadosDepois, ip, metodoHttp, rota }) {
  await pool.query(
    `INSERT INTO log_auditoria (usuario_id, entidade, entidade_id, acao, dados_antes, dados_depois, ip, metodo_http, rota)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      usuarioId ?? null,
      entidade,
      entidadeId ?? null,
      acao,
      dadosAntes ? JSON.stringify(sanitizar(dadosAntes)) : null,
      dadosDepois ? JSON.stringify(sanitizar(dadosDepois)) : null,
      ip ?? null,
      metodoHttp ?? null,
      rota ?? null,
    ]
  );
}

module.exports = { registrar, sanitizar };
