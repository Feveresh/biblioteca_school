// Normaliza texto pra comparação de busca "sem distinguir maiúscula/acento" (A = a, ç = c),
// igual nos dois motores de banco — evita depender da extensão unaccent do Postgres (nem
// sempre disponível, ex: em serviços gerenciados sem superusuário) e funciona sem alteração
// no SQLite. Usado tanto pra popular colunas "_busca" na escrita quanto pra normalizar o
// termo digitado na hora da busca.
function normalizarBusca(texto) {
  if (!texto) return null;
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

module.exports = { normalizarBusca };
