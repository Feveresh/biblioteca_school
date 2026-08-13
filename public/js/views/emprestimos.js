import { api } from '../api.js';
import { escapeHtml, mostrarToast, formatarData, confirmar, exportarCSV, imprimirTabela } from '../utils.js';

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
      <select id="filtro-aluno"><option value="">Aluno (todos)</option></select>
      <input type="date" id="filtro-de" title="De">
      <input type="date" id="filtro-ate" title="Até">
      <button id="btn-limpar-filtros" class="btn btn-secondary btn-sm">Limpar filtros</button>
      <button id="btn-exportar" class="btn btn-secondary btn-sm">⬇ Exportar CSV</button>
      <button id="btn-imprimir" class="btn btn-secondary btn-sm">🖨️ Imprimir</button>
    </div>

    <div class="tabela-wrap">
      <table>
        <thead>
          <tr>
            <th>Aluno</th><th>Turma</th><th>Livro</th>
            <th data-ordenar="data_emprestimo" style="cursor:pointer;user-select:none;">Emprestado em <span class="seta-ordenacao" data-seta="data_emprestimo"></span></th>
            <th data-ordenar="data_prevista" style="cursor:pointer;user-select:none;">Previsto <span class="seta-ordenacao" data-seta="data_prevista"></span></th>
            <th>Status</th><th></th>
          </tr>
        </thead>
        <tbody id="tbody-emprestimos"></tbody>
      </table>
    </div>

    <div class="toolbar" id="paginacao" style="justify-content:flex-end;margin-top:14px;"></div>
  `;

  const selectAluno = container.querySelector('#f-aluno');
  const selectLivro = container.querySelector('#f-livro');
  const inputData = container.querySelector('#f-data-prevista');
  const tbody = container.querySelector('#tbody-emprestimos');
  const erroEl = container.querySelector('#emprestimo-erro');
  const btnPendentes = container.querySelector('#btn-pendentes');
  const btnHistorico = container.querySelector('#btn-historico');
  const filtroAluno = container.querySelector('#filtro-aluno');
  const filtroDe = container.querySelector('#filtro-de');
  const filtroAte = container.querySelector('#filtro-ate');
  const paginacaoEl = container.querySelector('#paginacao');

  const { dias_emprestimo_padrao: diasPadrao } = await api.get('/api/configuracoes');
  const dataPadrao = new Date();
  dataPadrao.setDate(dataPadrao.getDate() + diasPadrao);
  inputData.value = dataPadrao.toISOString().slice(0, 10);

  let modoAtual = 'pendentes';
  let pagina = 1;
  const porPagina = 20;
  let ordenarPor = 'data_prevista';
  let ordem = 'asc';

  function badgeStatus(status) {
    if (status === 'atrasado') return '<span class="badge badge-perigo">Atrasado</span>';
    if (status === 'devolvido') return '<span class="badge badge-neutro">Devolvido</span>';
    return '<span class="badge badge-aviso">Pendente</span>';
  }

  function atualizarSetas() {
    container.querySelectorAll('.seta-ordenacao').forEach(el => {
      el.textContent = el.dataset.seta === ordenarPor ? (ordem === 'asc' ? '▲' : '▼') : '';
    });
  }

  async function carregarSelects() {
    const [{ dados: alunos }, { dados: livros }] = await Promise.all([
      api.get('/api/alunos?porPagina=500'),
      api.get('/api/livros?disponivel=true&porPagina=500'),
    ]);
    selectAluno.innerHTML = alunos.length
      ? alunos.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}${a.turma_nome ? ' — ' + escapeHtml(a.turma_nome) : ''}</option>`).join('')
      : '<option value="">Nenhum aluno cadastrado</option>';
    selectLivro.innerHTML = livros.length
      ? livros.map(l => `<option value="${l.id}">${escapeHtml(l.titulo)} (${escapeHtml(l.tombo)})</option>`).join('')
      : '<option value="">Nenhum livro disponível</option>';

    filtroAluno.innerHTML = '<option value="">Aluno (todos)</option>'
      + alunos.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join('');
  }

  async function carregarTabela() {
    tbody.innerHTML = `<tr><td colspan="7" class="celula-vazia">Carregando…</td></tr>`;
    const params = new URLSearchParams({ pagina, porPagina, ordenarPor, ordem });
    if (filtroAluno.value) params.set('aluno_id', filtroAluno.value);
    if (filtroDe.value) params.set('de', filtroDe.value);
    if (filtroAte.value) params.set('ate', filtroAte.value);

    const rota = modoAtual === 'historico' ? '/api/emprestimos' : '/api/emprestimos/pendentes';
    const { dados, total } = await api.get(`${rota}?${params.toString()}`);

    if (!dados.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="celula-vazia">Nenhum registro encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = dados.map(e => `
        <tr>
          <td>${escapeHtml(e.aluno)}</td>
          <td>${escapeHtml(e.turma || '—')}</td>
          <td>${escapeHtml(e.livro)}</td>
          <td>${formatarData(e.data_emprestimo)}</td>
          <td>${formatarData(e.data_prevista)}</td>
          <td>${badgeStatus(e.status)}</td>
          <td class="tabela-acoes">
            ${e.status !== 'devolvido' ? `
              <button class="btn btn-secondary btn-sm" data-renovar="${e.id}">Renovar</button>
              <button class="btn btn-primary btn-sm" data-devolver="${e.id}">Devolver</button>
            ` : ''}
          </td>
        </tr>
      `).join('');
    }

    atualizarSetas();

    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    paginacaoEl.innerHTML = `
      <button id="btn-anterior" class="btn btn-secondary btn-sm" ${pagina <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="sub">Página ${pagina} de ${totalPaginas} (${total} registro(s))</span>
      <button id="btn-proxima" class="btn btn-secondary btn-sm" ${pagina >= totalPaginas ? 'disabled' : ''}>Próxima →</button>
    `;
    paginacaoEl.querySelector('#btn-anterior').addEventListener('click', () => { pagina--; carregarTabela(); });
    paginacaoEl.querySelector('#btn-proxima').addEventListener('click', () => { pagina++; carregarTabela(); });
  }

  const ROTULOS_STATUS = { pendente: 'Pendente', atrasado: 'Atrasado', devolvido: 'Devolvido' };

  const COLUNAS_EXPORTACAO = [
    { rotulo: 'Aluno', valor: e => e.aluno },
    { rotulo: 'Turma', valor: e => e.turma || '' },
    { rotulo: 'Livro', valor: e => e.livro },
    { rotulo: 'Tombo', valor: e => e.tombo },
    { rotulo: 'Emprestado em', valor: e => formatarData(e.data_emprestimo) },
    { rotulo: 'Previsto', valor: e => formatarData(e.data_prevista) },
    { rotulo: 'Devolvido em', valor: e => formatarData(e.data_devolucao) },
    { rotulo: 'Status', valor: e => ROTULOS_STATUS[e.status] || e.status },
  ];

  async function buscarTudoFiltrado() {
    const params = new URLSearchParams({ porPagina: 500, ordenarPor, ordem });
    if (filtroAluno.value) params.set('aluno_id', filtroAluno.value);
    if (filtroDe.value) params.set('de', filtroDe.value);
    if (filtroAte.value) params.set('ate', filtroAte.value);

    const rota = modoAtual === 'historico' ? '/api/emprestimos' : '/api/emprestimos/pendentes';
    const { dados } = await api.get(`${rota}?${params.toString()}`);
    return dados;
  }

  async function exportar() {
    const dados = await buscarTudoFiltrado();
    if (!dados.length) {
      mostrarToast('Nada para exportar com os filtros atuais.', 'erro');
      return;
    }
    exportarCSV(`emprestimos-${modoAtual}-${new Date().toISOString().slice(0, 10)}.csv`, COLUNAS_EXPORTACAO, dados);
  }

  container.querySelector('#btn-exportar').addEventListener('click', () => {
    exportar().catch(err => mostrarToast(err.message, 'erro'));
  });

  container.querySelector('#btn-imprimir').addEventListener('click', async () => {
    const dados = await buscarTudoFiltrado();
    imprimirTabela('Empréstimos', COLUNAS_EXPORTACAO, dados, modoAtual === 'historico' ? 'Histórico completo' : 'Pendentes');
  });

  async function alternarModo(modo) {
    modoAtual = modo;
    pagina = 1;
    btnPendentes.classList.toggle('btn-primary', modo === 'pendentes');
    btnPendentes.classList.toggle('btn-secondary', modo !== 'pendentes');
    btnHistorico.classList.toggle('btn-primary', modo === 'historico');
    btnHistorico.classList.toggle('btn-secondary', modo !== 'historico');
    await carregarTabela();
  }

  btnPendentes.addEventListener('click', () => alternarModo('pendentes'));
  btnHistorico.addEventListener('click', () => alternarModo('historico'));
  filtroAluno.addEventListener('change', () => { pagina = 1; carregarTabela(); });
  filtroDe.addEventListener('change', () => { pagina = 1; carregarTabela(); });
  filtroAte.addEventListener('change', () => { pagina = 1; carregarTabela(); });
  container.querySelector('#btn-limpar-filtros').addEventListener('click', () => {
    filtroAluno.value = ''; filtroDe.value = ''; filtroAte.value = '';
    pagina = 1;
    carregarTabela();
  });

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
      carregarTabela();
    });
  });

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
    const idDevolver = e.target.dataset.devolver;
    const idRenovar = e.target.dataset.renovar;

    if (idDevolver) {
      const ok = await confirmar('Confirmar devolução deste livro?', {
        titulo: 'Registrar devolução', textoConfirmar: 'Devolver',
      });
      if (!ok) return;
      try {
        await api.patch(`/api/emprestimos/${idDevolver}/devolver`);
        mostrarToast('Devolução registrada.', 'sucesso');
        await carregarSelects();
        await carregarTabela();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }

    if (idRenovar) {
      const ok = await confirmar(`Estender o prazo em ${diasPadrao} dia(s) a partir da data prevista atual?`, {
        titulo: 'Renovar empréstimo', textoConfirmar: 'Renovar',
      });
      if (!ok) return;
      try {
        await api.patch(`/api/emprestimos/${idRenovar}/renovar`);
        mostrarToast('Empréstimo renovado.', 'sucesso');
        await carregarTabela();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  await carregarSelects();
  await carregarTabela();
}
