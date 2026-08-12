import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar, debounce } from '../utils.js';

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
    </div>
    <div class="tabela-wrap">
      <table>
        <thead>
          <tr><th>Nome</th><th>Turma</th><th></th></tr>
        </thead>
        <tbody id="tbody-alunos"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#tbody-alunos');
  const inputBusca = container.querySelector('#busca-aluno');

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="3" class="celula-vazia">Carregando…</td></tr>`;
    const query = inputBusca.value.trim();
    const alunos = await api.get(`/api/alunos${query ? `?busca=${encodeURIComponent(query)}` : ''}`);
    if (!alunos.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="celula-vazia">Nenhum aluno encontrado.</td></tr>`;
      return;
    }
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
        carregar();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  container.querySelector('#btn-novo-aluno').addEventListener('click', () => abrirFormulario(null));
  inputBusca.addEventListener('input', debounce(carregar, 350));

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
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  await carregar();
}
