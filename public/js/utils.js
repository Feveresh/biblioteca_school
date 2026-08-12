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

export function mostrarToast(mensagem, tipo = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

const overlay = document.getElementById('modal-overlay');
const modalTitulo = document.getElementById('modal-titulo');
const modalCorpo = document.getElementById('modal-corpo');
document.getElementById('modal-fechar').addEventListener('click', fecharModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

export function abrirModal(titulo, conteudoHtml) {
  modalTitulo.textContent = titulo;
  modalCorpo.innerHTML = conteudoHtml;
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
