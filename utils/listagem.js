// Nome de coluna no ORDER BY não aceita bind parameter ($1) no Postgres — por isso
// validamos contra uma allow-list por recurso em vez de tentar sanitizar livremente.
function construirOrdenacao(ordenarPor, ordem, colunasPermitidas, colunaPadrao) {
  const coluna = colunasPermitidas.includes(ordenarPor) ? ordenarPor : colunaPadrao;
  const direcao = ordem === 'desc' ? 'DESC' : 'ASC';
  return `${coluna} ${direcao}`;
}

// porPagina até 500: confortável para popular selects (ex: livros disponíveis num
// empréstimo) sem paginação de verdade, mantendo um teto contra abuso.
function construirPaginacao(query, porPaginaPadrao = 20) {
  const pagina = Math.max(1, Number(query.pagina) || 1);
  const porPagina = Math.min(500, Math.max(1, Number(query.porPagina) || porPaginaPadrao));
  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}

module.exports = { construirOrdenacao, construirPaginacao };
