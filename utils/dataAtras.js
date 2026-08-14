// Fragmentos SQL portáteis pra aritmética de data ("N dias/minutos atrás", "início do mês
// N meses atrás") — Postgres usa INTERVAL, SQLite usa date()/datetime() com modificadores.
// `placeholder` é o parâmetro já no formato usado em todo o resto do código ($1, $2...) —
// o adaptador (config/db.js) já traduz $N -> ? pro SQLite igual faz com qualquer outra
// query, então aqui não precisa se preocupar com a sintaxe do bind, só com a função certa.
const pool = require('../config/db');
const usaSqlite = pool.usaSqlite;

// "N dias atrás" por data (sem hora) — ex: WHERE criado_em >= ${diasAtras('$1')}
function diasAtras(placeholder) {
  return usaSqlite
    ? `date('now', '-' || ${placeholder} || ' days')`
    : `CURRENT_DATE - (${placeholder} || ' days')::interval`;
}

// "N minutos atrás" por data e hora — ex: WHERE criado_em > ${minutosAtras('$2')}
function minutosAtras(placeholder) {
  return usaSqlite
    ? `datetime('now', '-' || ${placeholder} || ' minutes')`
    : `NOW() - (${placeholder} || ' minutes')::interval`;
}

// Início do mês, N meses atrás (N é sempre uma constante interna, nunca vira parâmetro).
function inicioDoMesAtras(n) {
  return usaSqlite
    ? `date('now', 'start of month', '-${n} months')`
    : `date_trunc('month', CURRENT_DATE) - INTERVAL '${n} months'`;
}

// Soma N dias a uma coluna de data já existente (não a "agora") — ex: renovar prazo de
// empréstimo somando dias à data_prevista atual, não à data de hoje.
function somarDias(coluna, placeholder) {
  return usaSqlite
    ? `date(${coluna}, '+' || ${placeholder} || ' days')`
    : `(${coluna} + (${placeholder} || ' days')::interval)::date`;
}

module.exports = { diasAtras, minutosAtras, inicioDoMesAtras, somarDias };
