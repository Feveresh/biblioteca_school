import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar, debounce } from '../utils.js';

const COLUNAS = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'turma', rotulo: 'Turma' },
];

export default async function renderAlunos(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Alunos</h1>
        <div class="sub">Alunos cadastrados na biblioteca</div>
      </div>
      <button id="btn-novo-aluno" class="btn btn-primary">+ Novo aluno</button>
    </div>
    <div class="toolbar">
      <input type="search" id="busca-aluno" placeholder="Buscar por nome ou turma…">
      <select id="filtro-turma"><option value="">Turma (todas)</option></select>
    </div>
    <div class="tabela-wrap">
      <table>
        <thead>
          <tr>
            ${COLUNAS.map(c => `<th data-ordenar="${c.chave}" style="cursor:pointer;user-select:none;">${c.rotulo} <span class="seta-ordenacao" data-seta="${c.chave}"></span></th>`).join('')}
            <th></th>
          </tr>
        </thead>
        <tbody id="tbody-alunos"></tbody>
      </table>
    </div>
    <div class="toolbar" id="paginacao" style="justify-content:flex-end;margin-top:14px;"></div>
  `;

  const tbody = container.querySelector('#tbody-alunos');
  const inputBusca = container.querySelector('#busca-aluno');
  const filtroTurma = container.querySelector('#filtro-turma');
  const paginacaoEl = container.querySelector('#paginacao');

  let pagina = 1;
  const porPagina = 20;
  let ordenarPor = 'nome';
  let ordem = 'asc';

  function atualizarSetas() {
    container.querySelectorAll('.seta-ordenacao').forEach(el => {
      el.textContent = el.dataset.seta === ordenarPor ? (ordem === 'asc' ? '▲' : '▼') : '';
    });
  }

  async function carregarTurmas() {
    const turmas = await api.get('/api/alunos/turmas');
    filtroTurma.innerHTML = '<option value="">Turma (todas)</option>'
      + turmas.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  }

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="3" class="celula-vazia">Carregando…</td></tr>`;
    const params = new URLSearchParams({ pagina, porPagina, ordenarPor, ordem });
    const busca = inputBusca.value.trim();
    if (busca) params.set('busca', busca);
    if (filtroTurma.value) params.set('turma', filtroTurma.value);

    const { dados: alunos, total } = await api.get(`/api/alunos?${params.toString()}`);

    if (!alunos.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="celula-vazia">Nenhum aluno encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = alunos.map(a => `
        <tr>
          <td>${escapeHtml(a.nome)}</td>
          <td>${escapeHtml(a.turma || '—')}</td>
          <td class="tabela-acoes">
            <button class="btn btn-secondary btn-sm" data-editar="${a.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-excluir="${a.id}">Excluir</button>
          </td>
        </tr>
      `).join('');
    }

    atualizarSetas();

    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    paginacaoEl.innerHTML = `
      <button id="btn-anterior" class="btn btn-secondary btn-sm" ${pagina <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="sub">Página ${pagina} de ${totalPaginas} (${total} aluno(s))</span>
      <button id="btn-proxima" class="btn btn-secondary btn-sm" ${pagina >= totalPaginas ? 'disabled' : ''}>Próxima →</button>
    `;
    paginacaoEl.querySelector('#btn-anterior').addEventListener('click', () => { pagina--; carregar(); });
    paginacaoEl.querySelector('#btn-proxima').addEventListener('click', () => { pagina++; carregar(); });
  }

  function abrirFormulario(aluno) {
    const editando = Boolean(aluno);
    const corpo = abrirModal(editando ? 'Editar aluno' : 'Novo aluno', `
      <form id="form-aluno">
        <div class="campo">
          <label for="f-nome">Nome</label>
          <input id="f-nome" required value="${aluno ? escapeHtml(aluno.nome) : ''}">
        </div>
        <div class="campo">
          <label for="f-turma">Turma</label>
          <input id="f-turma" value="${aluno && aluno.turma ? escapeHtml(aluno.turma) : ''}">
        </div>
        <p id="form-aluno-erro" class="mensagem-erro hidden"></p>
        <div class="modal-acoes">
          <button type="button" class="btn btn-secondary" id="cancelar-aluno">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    `);

    corpo.querySelector('#cancelar-aluno').addEventListener('click', fecharModal);
    corpo.querySelector('#form-aluno').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = corpo.querySelector('#form-aluno-erro');
      erroEl.classList.add('hidden');
      const dados = {
        nome: corpo.querySelector('#f-nome').value.trim(),
        turma: corpo.querySelector('#f-turma').value.trim() || null,
      };
      try {
        if (editando) {
          await api.put(`/api/alunos/${aluno.id}`, dados);
          mostrarToast('Aluno atualizado.', 'sucesso');
        } else {
          await api.post('/api/alunos', dados);
          mostrarToast('Aluno cadastrado.', 'sucesso');
        }
        fecharModal();
        carregarTurmas();
        carregar();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  container.querySelector('#btn-novo-aluno').addEventListener('click', () => abrirFormulario(null));
  inputBusca.addEventListener('input', debounce(() => { pagina = 1; carregar(); }, 350));
  filtroTurma.addEventListener('change', () => { pagina = 1; carregar(); });

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
      const aluno = await api.get(`/api/alunos/${idEditar}`);
      abrirFormulario(aluno);
    }
    if (idExcluir) {
      const ok = await confirmar('Tem certeza que deseja excluir este aluno? Essa ação não pode ser desfeita.', {
        titulo: 'Excluir aluno', textoConfirmar: 'Excluir', perigo: true,
      });
      if (!ok) return;
      try {
        await api.delete(`/api/alunos/${idExcluir}`);
        mostrarToast('Aluno removido.', 'sucesso');
        carregarTurmas();
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  await carregarTurmas();
  await carregar();
}
