// Compara duas versões no formato "x.y.z" (sem dependência de pacote semver externo,
// só pro caso simples de comparar números de versão do próprio sistema).
// Retorna 1 se a > b, -1 se a < b, 0 se iguais. Partes ausentes/não numéricas contam como 0.
function compararVersoes(a, b) {
  const partesA = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const partesB = String(b).split('.').map(n => parseInt(n, 10) || 0);
  const tamanho = Math.max(partesA.length, partesB.length);
  for (let i = 0; i < tamanho; i++) {
    const x = partesA[i] || 0;
    const y = partesB[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

module.exports = { compararVersoes };
