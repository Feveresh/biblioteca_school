import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar, debounce } from '../utils.js';

const COLUNAS = [
  { chave: 'tombo', rotulo: 'Tombo' },
  { chave: 'titulo', rotulo: 'Título' },
  { chave: 'autor', rotulo: 'Autor' },
];

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
      <select id="filtro-disponivel">
        <option value="">Disponibilidade (todas)</option>
        <option value="true">Disponíveis</option>
        <option value="false">Emprestados</option>
      </select>
    </div>
    <div class="tabela-wrap">
      <table>
        <thead>
          <tr>
            ${COLUNAS.map(c => `<th data-ordenar="${c.chave}" style="cursor:pointer;user-select:none;">${c.rotulo} <span class="seta-ordenacao" data-seta="${c.chave}"></span></th>`).join('')}
            <th>Localização</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody id="tbody-livros"></tbody>
      </table>
    </div>
    <div class="toolbar" id="paginacao" style="justify-content:flex-end;margin-top:14px;"></div>
  `;

  const tbody = container.querySelector('#tbody-livros');
  const inputBusca = container.querySelector('#busca-livro');
  const filtroDisponivel = container.querySelector('#filtro-disponivel');
  const paginacaoEl = container.querySelector('#paginacao');

  let pagina = 1;
  const porPagina = 20;
  let ordenarPor = 'titulo';
  let ordem = 'asc';

  function atualizarSetas() {
    container.querySelectorAll('.seta-ordenacao').forEach(el => {
      el.textContent = el.dataset.seta === ordenarPor ? (ordem === 'asc' ? '▲' : '▼') : '';
    });
  }

  function localizacao(livro) {
    if (!livro.estante && !livro.prateleira) return '—';
    return [livro.estante, livro.prateleira].filter(Boolean).join(' / ');
  }

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="6" class="celula-vazia">Carregando…</td></tr>`;
    const params = new URLSearchParams({ pagina, porPagina, ordenarPor, ordem });
    const busca = inputBusca.value.trim();
    if (busca) params.set('busca', busca);
    if (filtroDisponivel.value) params.set('disponivel', filtroDisponivel.value);

    const { dados: livros, total } = await api.get(`/api/livros?${params.toString()}`);

    if (!livros.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="celula-vazia">Nenhum livro encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = livros.map(l => `
        <tr>
          <td>${escapeHtml(l.tombo)}</td>
          <td>${escapeHtml(l.titulo)}</td>
          <td>${escapeHtml(l.autor || '—')}</td>
          <td>${escapeHtml(localizacao(l))}</td>
          <td>${l.disponivel ? '<span class="badge badge-sucesso">Disponível</span>' : '<span class="badge badge-neutro">Emprestado</span>'}</td>
          <td class="tabela-acoes">
            <button class="btn btn-secondary btn-sm" data-editar="${l.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-excluir="${l.id}">Excluir</button>
          </td>
        </tr>
      `).join('');
    }

    atualizarSetas();

    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    paginacaoEl.innerHTML = `
      <button id="btn-anterior" class="btn btn-secondary btn-sm" ${pagina <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="sub">Página ${pagina} de ${totalPaginas} (${total} livro(s))</span>
      <button id="btn-proxima" class="btn btn-secondary btn-sm" ${pagina >= totalPaginas ? 'disabled' : ''}>Próxima →</button>
    `;
    paginacaoEl.querySelector('#btn-anterior').addEventListener('click', () => { pagina--; carregar(); });
    paginacaoEl.querySelector('#btn-proxima').addEventListener('click', () => { pagina++; carregar(); });
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
        <div class="form-linha">
          <div class="campo">
            <label for="f-estante">Estante</label>
            <input id="f-estante" value="${livro && livro.estante ? escapeHtml(livro.estante) : ''}">
          </div>
          <div class="campo">
            <label for="f-prateleira">Prateleira</label>
            <input id="f-prateleira" value="${livro && livro.prateleira ? escapeHtml(livro.prateleira) : ''}">
          </div>
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
        estante: corpo.querySelector('#f-estante').value.trim() || null,
        prateleira: corpo.querySelector('#f-prateleira').value.trim() || null,
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
  inputBusca.addEventListener('input', debounce(() => { pagina = 1; carregar(); }, 350));
  filtroDisponivel.addEventListener('change', () => { pagina = 1; carregar(); });

  container.querySelectorAll('[data-ordenar]').forEach(th => {
    th.addEventListener('click', () => {
      const coluna = th.dataset.ordenar;
      if (ordenarPor === coluna) {
        ordem = ordem === 'asc' ? 'desc' : 'asc';
      } else {
        ordenarPor = coluna;
        ordem = 'asc';
      }
      pagina = 1;
      carregar();
    });
  });

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
