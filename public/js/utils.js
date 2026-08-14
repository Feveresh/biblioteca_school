export function formatarData(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

export function debounce(fn, atraso = 300) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), atraso);
  };
}

// Gera um CSV a partir de linhas de objetos e dispara o download no navegador —
// sem endpoint no backend: os dados já estão na tela (ou são buscados sem paginação
// antes de chamar isto), então gerar o arquivo no cliente evita ida e volta ao servidor.
export function exportarCSV(nomeArquivo, colunas, linhas) {
  const escaparCampo = (valor) => {
    const texto = String(valor ?? '');
    return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const cabecalho = colunas.map(c => escaparCampo(c.rotulo)).join(';');
  const corpo = linhas.map(linha => colunas.map(c => escaparCampo(c.valor(linha))).join(';')).join('\n');
  // BOM UTF-8 no início — sem isso o Excel abre acentos quebrados em CSV. Usa o escape
  // ﻿ (não um caractere literal) porque um BOM literal no arquivo-fonte vira
  // metadado de encoding do próprio arquivo .js em vez de virar conteúdo real da string.
  const conteudo = '﻿' + cabecalho + '\n' + corpo;

  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Imprime uma tabela (mesma forma de "colunas" do exportarCSV: { rotulo, valor(linha) })
// numa aba nova e isolada — evita ter que esconder a barra lateral/filtros/botões da SPA
// com CSS de impressão, e dá controle total do layout impresso.
export function imprimirTabela(titulo, colunas, linhas, subtitulo = '') {
  const janela = window.open('', '_blank');
  if (!janela) {
    mostrarToast('O navegador bloqueou a janela de impressão. Permita pop-ups pra este site.', 'erro');
    return;
  }

  const linhasHtml = linhas.map(linha => `
    <tr>${colunas.map(c => `<td>${escapeHtml(c.valor(linha))}</td>`).join('')}</tr>
  `).join('');

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(titulo)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1e2130; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .sub { font-size: 12px; color: #6b7280; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
        th { background: #f4f6fb; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(titulo)}</h1>
      <div class="sub">${subtitulo ? escapeHtml(subtitulo) + ' — ' : ''}${linhas.length} registro(s) — gerado em ${new Date().toLocaleString('pt-BR')}</div>
      <table>
        <thead><tr>${colunas.map(c => `<th>${escapeHtml(c.rotulo)}</th>`).join('')}</tr></thead>
        <tbody>${linhasHtml}</tbody>
      </table>
    </body>
    </html>
  `);
  janela.document.close();
  janela.onload = () => janela.print();
}

// Imprime imagens (ex: gráficos capturados de <canvas> via toDataURL) numa aba nova,
// uma por linha, com título.
export function imprimirImagens(titulo, imagens, subtitulo = '') {
  const janela = window.open('', '_blank');
  if (!janela) {
    mostrarToast('O navegador bloqueou a janela de impressão. Permita pop-ups pra este site.', 'erro');
    return;
  }

  const imagensHtml = imagens.map(img => `
    <div class="grafico">
      <h2>${escapeHtml(img.titulo)}</h2>
      <img src="${img.dataUrl}" alt="${escapeHtml(img.titulo)}">
    </div>
  `).join('');

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(titulo)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1e2130; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .sub { font-size: 12px; color: #6b7280; margin: 0 0 24px; }
        .grafico { margin-bottom: 28px; page-break-inside: avoid; }
        .grafico h2 { font-size: 14px; margin: 0 0 8px; }
        .grafico img { max-width: 100%; border: 1px solid #ddd; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(titulo)}</h1>
      <div class="sub">${subtitulo ? escapeHtml(subtitulo) + ' — ' : ''}gerado em ${new Date().toLocaleString('pt-BR')}</div>
      ${imagensHtml}
    </body>
    </html>
  `);
  janela.document.close();
  janela.onload = () => janela.print();
}

export function mostrarToast(mensagem, tipo = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

const overlay = document.getElementById('modal-overlay');
const modal = overlay.querySelector('.modal');
const modalTitulo = document.getElementById('modal-titulo');
const modalCorpo = document.getElementById('modal-corpo');
document.getElementById('modal-fechar').addEventListener('click', fecharModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

// opcoes.grande: formulários com muitos campos (livro, papel) usam um modal mais largo,
// com os campos organizados em grade, em vez de empilhados numa coluna estreita.
export function abrirModal(titulo, conteudoHtml, opcoes = {}) {
  modalTitulo.textContent = titulo;
  modalCorpo.innerHTML = conteudoHtml;
  modal.classList.toggle('modal-grande', Boolean(opcoes.grande));
  overlay.classList.remove('hidden');
  return modalCorpo;
}

let resolverConfirmacao = null;

export function fecharModal() {
  overlay.classList.add('hidden');
  modalCorpo.innerHTML = '';
  if (resolverConfirmacao) {
    const resolver = resolverConfirmacao;
    resolverConfirmacao = null;
    resolver(false);
  }
}

export function confirmar(mensagem, opcoes = {}) {
  const { titulo = 'Confirmar ação', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = false } = opcoes;
  return new Promise((resolve) => {
    resolverConfirmacao = resolve;
    const corpo = abrirModal(titulo, `
      <p style="margin:0 0 20px;">${escapeHtml(mensagem)}</p>
      <div class="modal-acoes">
        <button type="button" class="btn btn-secondary" id="confirmar-nao">${textoCancelar}</button>
        <button type="button" class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" id="confirmar-sim">${textoConfirmar}</button>
      </div>
    `);
    corpo.querySelector('#confirmar-sim').addEventListener('click', () => {
      resolverConfirmacao = null;
      resolve(true);
      fecharModal();
    });
    corpo.querySelector('#confirmar-nao').addEventListener('click', fecharModal);
  });
}
