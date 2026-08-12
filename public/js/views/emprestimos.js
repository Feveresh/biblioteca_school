import { api } from '../api.js';
import { escapeHtml, mostrarToast, formatarData, confirmar } from '../utils.js';

export default async function renderEmprestimos(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Empréstimos</h1>
        <div class="sub">Registre novos empréstimos e devoluções</div>
      </div>
    </div>

    <div class="painel">
      <h2>Novo empréstimo</h2>
      <form id="form-emprestimo" class="form-linha">
        <div class="campo">
          <label for="f-aluno">Aluno</label>
          <select id="f-aluno" required></select>
        </div>
        <div class="campo">
          <label for="f-livro">Livro disponível</label>
          <select id="f-livro" required></select>
        </div>
        <div class="campo">
          <label for="f-data-prevista">Devolução prevista</label>
          <input type="date" id="f-data-prevista" required>
        </div>
        <div class="campo">
          <button type="submit" class="btn btn-primary btn-block">Emprestar</button>
        </div>
      </form>
      <p id="emprestimo-erro" class="mensagem-erro hidden"></p>
    </div>

    <div class="toolbar">
      <button id="btn-pendentes" class="btn btn-primary btn-sm">Pendentes</button>
      <button id="btn-historico" class="btn btn-secondary btn-sm">Histórico completo</button>
    </div>

    <div class="tabela-wrap">
      <table>
        <thead>
          <tr><th>Aluno</th><th>Turma</th><th>Livro</th><th>Emprestado em</th><th>Previsto</th><th>Status</th><th></th></tr>
        </thead>
        <tbody id="tbody-emprestimos"></tbody>
      </table>
    </div>
  `;

  const selectAluno = container.querySelector('#f-aluno');
  const selectLivro = container.querySelector('#f-livro');
  const inputData = container.querySelector('#f-data-prevista');
  const tbody = container.querySelector('#tbody-emprestimos');
  const erroEl = container.querySelector('#emprestimo-erro');
  const btnPendentes = container.querySelector('#btn-pendentes');
  const btnHistorico = container.querySelector('#btn-historico');

  const daquiSeteDias = new Date();
  daquiSeteDias.setDate(daquiSeteDias.getDate() + 7);
  inputData.value = daquiSeteDias.toISOString().slice(0, 10);

  function badgeStatus(status) {
    if (status === 'atrasado') return '<span class="badge badge-perigo">Atrasado</span>';
    if (status === 'devolvido') return '<span class="badge badge-neutro">Devolvido</span>';
    return '<span class="badge badge-aviso">Pendente</span>';
  }

  async function carregarSelects() {
    const [alunos, livros] = await Promise.all([
      api.get('/api/alunos'),
      api.get('/api/livros?disponivel=true'),
    ]);
    selectAluno.innerHTML = alunos.length
      ? alunos.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}${a.turma ? ' — ' + escapeHtml(a.turma) : ''}</option>`).join('')
      : '<option value="">Nenhum aluno cadastrado</option>';
    selectLivro.innerHTML = livros.length
      ? livros.map(l => `<option value="${l.id}">${escapeHtml(l.titulo)} (${escapeHtml(l.tombo)})</option>`).join('')
      : '<option value="">Nenhum livro disponível</option>';
  }

  let modoAtual = 'pendentes';

  async function carregarTabela() {
    tbody.innerHTML = `<tr><td colspan="7" class="celula-vazia">Carregando…</td></tr>`;
    const dados = modoAtual === 'historico'
      ? await api.get('/api/emprestimos')
      : await api.get('/api/emprestimos/pendentes');

    if (!dados.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="celula-vazia">Nenhum registro encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = dados.map(e => `
      <tr>
        <td>${escapeHtml(e.aluno)}</td>
        <td>${escapeHtml(e.turma || '—')}</td>
        <td>${escapeHtml(e.livro)}</td>
        <td>${formatarData(e.data_emprestimo)}</td>
        <td>${formatarData(e.data_prevista)}</td>
        <td>${badgeStatus(e.status)}</td>
        <td class="tabela-acoes">
          ${e.status !== 'devolvido' ? `<button class="btn btn-primary btn-sm" data-devolver="${e.id}">Devolver</button>` : ''}
        </td>
      </tr>
    `).join('');
  }

  async function alternarModo(modo) {
    modoAtual = modo;
    btnPendentes.classList.toggle('btn-primary', modo === 'pendentes');
    btnPendentes.classList.toggle('btn-secondary', modo !== 'pendentes');
    btnHistorico.classList.toggle('btn-primary', modo === 'historico');
    btnHistorico.classList.toggle('btn-secondary', modo !== 'historico');
    await carregarTabela();
  }

  btnPendentes.addEventListener('click', () => alternarModo('pendentes'));
  btnHistorico.addEventListener('click', () => alternarModo('historico'));

  container.querySelector('#form-emprestimo').addEventListener('submit', async (e) => {
    e.preventDefault();
    erroEl.classList.add('hidden');
    if (!selectAluno.value || !selectLivro.value) return;
    try {
      await api.post('/api/emprestimos', {
        aluno_id: Number(selectAluno.value),
        livro_id: Number(selectLivro.value),
        data_prevista: inputData.value,
      });
      mostrarToast('Empréstimo registrado.', 'sucesso');
      await carregarSelects();
      await carregarTabela();
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.classList.remove('hidden');
    }
  });

  tbody.addEventListener('click', async (e) => {
    const id = e.target.dataset.devolver;
    if (!id) return;
    const ok = await confirmar('Confirmar devolução deste livro?', {
      titulo: 'Registrar devolução', textoConfirmar: 'Devolver',
    });
    if (!ok) return;
    try {
      await api.patch(`/api/emprestimos/${id}/devolver`);
      mostrarToast('Devolução registrada.', 'sucesso');
      await carregarSelects();
      await carregarTabela();
    } catch (err) {
      mostrarToast(err.message, 'erro');
    }
  });

  await carregarSelects();
  await carregarTabela();
}
