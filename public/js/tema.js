const TEMA_KEY = 'biblioteca_tema';

export function temaAtual() {
  return document.documentElement.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function alternarTema() {
  const novoTema = temaAtual() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', novoTema);
  localStorage.setItem(TEMA_KEY, novoTema);
  return novoTema;
}
