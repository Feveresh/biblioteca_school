import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar, debounce } from '../utils.js';

export default async function renderLivros(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Livros</h1>
        <div class="sub">Acervo da biblioteca</div>
      </div>
      <button id="btn-novo-livro" class="btn btn-primary">+ Novo livro</button>
    </div>
    <div class="toolbar">
      <input type="search" id="busca-livro" placeholder="Buscar por título, autor ou tombo…">
    </div>
    <div class="tabela-wrap">
      <table>
        <thead>
          <tr><th>Tombo</th><th>Título</th><th>Autor</th><th>Status</th><th></th></tr>
        </thead>
        <tbody id="tbody-livros"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#tbody-livros');
  const inputBusca = container.querySelector('#busca-livro');

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="5" class="celula-vazia">Carregando…</td></tr>`;
    const query = inputBusca.value.trim();
    const livros = await api.get(`/api/livros${query ? `?busca=${encodeURIComponent(query)}` : ''}`);
    if (!livros.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="celula-vazia">Nenhum livro encontrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = livros.map(l => `
      <tr>
        <td>${escapeHtml(l.tombo)}</td>
        <td>${escapeHtml(l.titulo)}</td>
        <td>${escapeHtml(l.autor || '—')}</td>
        <td>${l.disponivel ? '<span class="badge badge-sucesso">Disponível</span>' : '<span class="badge badge-neutro">Emprestado</span>'}</td>
        <td class="tabela-acoes">
          <button class="btn btn-secondary btn-sm" data-editar="${l.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-excluir="${l.id}">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  function abrirFormulario(livro) {
    const editando = Boolean(livro);
    const corpo = abrirModal(editando ? 'Editar livro' : 'Novo livro', `
      <form id="form-livro">
        <div class="campo">
          <label for="f-tombo">Tombo</label>
          <input id="f-tombo" required value="${livro ? escapeHtml(livro.tombo) : ''}">
        </div>
        <div class="campo">
          <label for="f-titulo">Título</label>
          <input id="f-titulo" required value="${livro ? escapeHtml(livro.titulo) : ''}">
        </div>
        <div class="campo">
          <label for="f-autor">Autor</label>
          <input id="f-autor" value="${livro && livro.autor ? escapeHtml(livro.autor) : ''}">
        </div>
        <p id="form-livro-erro" class="mensagem-erro hidden"></p>
        <div class="modal-acoes">
          <button type="button" class="btn btn-secondary" id="cancelar-livro">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    `);

    corpo.querySelector('#cancelar-livro').addEventListener('click', fecharModal);
    corpo.querySelector('#form-livro').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = corpo.querySelector('#form-livro-erro');
      erroEl.classList.add('hidden');
      const dados = {
        tombo: corpo.querySelector('#f-tombo').value.trim(),
        titulo: corpo.querySelector('#f-titulo').value.trim(),
        autor: corpo.querySelector('#f-autor').value.trim() || null,
      };
      try {
        if (editando) {
          await api.put(`/api/livros/${livro.id}`, dados);
          mostrarToast('Livro atualizado.', 'sucesso');
        } else {
          await api.post('/api/livros', dados);
          mostrarToast('Livro cadastrado.', 'sucesso');
        }
        fecharModal();
        carregar();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  container.querySelector('#btn-novo-livro').addEventListener('click', () => abrirFormulario(null));
  inputBusca.addEventListener('input', debounce(carregar, 350));

  tbody.addEventListener('click', async (e) => {
    const idEditar = e.target.dataset.editar;
    const idExcluir = e.target.dataset.excluir;
    if (idEditar) {
      const livro = await api.get(`/api/livros/${idEditar}`);
      abrirFormulario(livro);
    }
    if (idExcluir) {
      const ok = await confirmar('Tem certeza que deseja excluir este livro? Essa ação não pode ser desfeita.', {
        titulo: 'Excluir livro', textoConfirmar: 'Excluir', perigo: true,
      });
      if (!ok) return;
      try {
        await api.delete(`/api/livros/${idExcluir}`);
        mostrarToast('Livro removido.', 'sucesso');
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  await carregar();
}
