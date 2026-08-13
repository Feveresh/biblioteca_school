import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

const PALETA = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#9333ea', '#db2777', '#65a30d', '#0284c7', '#ea580c', '#4338ca', '#0f766e'];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rotuloMes(mesIso) {
  const [ano, mes] = mesIso.split('-');
  return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
}

function corVar(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

// Chart.js não solta a referência do canvas sozinho quando o innerHTML da view é
// trocado numa nova navegação — guardamos as instâncias pra destruir explicitamente
// antes de recriar, evitando vazamento de memória ao entrar e sair da tela.
let graficosAtivos = [];

function destruirGraficos() {
  graficosAtivos.forEach(g => g.destroy());
  graficosAtivos = [];
}

function criarGrafico(canvas, config) {
  graficosAtivos.push(new Chart(canvas, config));
}

function opcoesEixo(cores) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: cores.textoMuted }, grid: { color: cores.borda } },
      y: { ticks: { color: cores.textoMuted }, grid: { color: cores.borda }, beginAtZero: true },
    },
  };
}

function opcoesRosca(cores) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: cores.texto } } },
  };
}

export default async function renderEstatisticas(container) {
  const dados = await api.get('/api/estatisticas');
  const temAuditoria = Boolean(dados.auditoria);

  const cores = {
    primaria: corVar('--color-primary'),
    sucesso: corVar('--color-success'),
    aviso: corVar('--color-warning'),
    perigo: corVar('--color-danger'),
    texto: corVar('--color-text'),
    textoMuted: corVar('--color-text-muted'),
    borda: corVar('--color-border'),
  };

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Estatísticas</h1>
        <div class="sub">Visão analítica da biblioteca</div>
      </div>
    </div>

    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-icone">⏱️</div>
        <div class="stat-valor">${dados.tempoMedioDevolucaoDias}</div>
        <div class="stat-label">Dias em média até devolução</div>
      </div>
      <div class="stat-card aviso">
        <div class="stat-icone">📦</div>
        <div class="stat-valor">${dados.livrosParados.total}</div>
        <div class="stat-label">Livros nunca emprestados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icone">🙈</div>
        <div class="stat-valor">${dados.alunosSemEmprestimo}</div>
        <div class="stat-label">Alunos sem nenhum empréstimo</div>
      </div>
    </div>

    <div class="painel">
      <h2>Empréstimos por mês</h2>
      <div class="sub">Últimos 12 meses</div>
      <div class="grafico-wrap"><canvas id="g-mes"></canvas></div>
    </div>

    <div class="grid-graficos">
      <div class="painel">
        <h2>Status dos empréstimos</h2>
        <div class="grafico-wrap"><canvas id="g-status"></canvas></div>
      </div>
      <div class="painel">
        <h2>Disponibilidade do acervo</h2>
        <div class="grafico-wrap"><canvas id="g-disponibilidade"></canvas></div>
      </div>
    </div>

    <div class="painel">
      <h2>Livros por gênero</h2>
      <div class="grafico-wrap alto"><canvas id="g-genero"></canvas></div>
    </div>

    <div class="grid-graficos">
      <div class="painel">
        <h2>Uso da biblioteca por turma</h2>
        <div class="sub">Número de empréstimos</div>
        <div class="grafico-wrap"><canvas id="g-uso-turma"></canvas></div>
      </div>
      <div class="painel">
        <h2>Alunos por turma</h2>
        <div class="grafico-wrap"><canvas id="g-alunos-turma"></canvas></div>
      </div>
    </div>

    <div class="grid-graficos">
      <div class="painel">
        <h2>Livros mais emprestados</h2>
        <div class="grafico-wrap alto"><canvas id="g-top-livros"></canvas></div>
      </div>
      <div class="painel">
        <h2>Alunos que mais emprestam</h2>
        <div class="grafico-wrap alto"><canvas id="g-top-alunos"></canvas></div>
      </div>
    </div>

    ${dados.livrosParados.lista.length ? `
      <div class="painel">
        <h2>Acervo parado</h2>
        <div class="sub">Livros que nunca foram emprestados${dados.livrosParados.total > dados.livrosParados.lista.length ? ` (mostrando ${dados.livrosParados.lista.length} de ${dados.livrosParados.total})` : ''}</div>
        <div class="tabela-wrap" style="box-shadow:none;border:none;">
          <table>
            <thead><tr><th>Título</th><th>Tombo</th></tr></thead>
            <tbody>
              ${dados.livrosParados.lista.map(l => `<tr><td>${escapeHtml(l.titulo)}</td><td>${escapeHtml(l.tombo)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${temAuditoria ? `
      <div class="secao-titulo">Atividade do sistema (últimos 30 dias)</div>
      <div class="grid-graficos">
        <div class="painel">
          <h2>Ações mais frequentes</h2>
          <div class="grafico-wrap"><canvas id="g-auditoria-acao"></canvas></div>
        </div>
        <div class="painel">
          <h2>Usuários mais ativos</h2>
          <div class="grafico-wrap"><canvas id="g-auditoria-usuario"></canvas></div>
        </div>
      </div>
    ` : ''}
  `;

  destruirGraficos();

  criarGrafico(container.querySelector('#g-mes'), {
    type: 'bar',
    data: {
      labels: dados.emprestimosPorMes.map(m => rotuloMes(m.mes)),
      datasets: [{ label: 'Empréstimos', data: dados.emprestimosPorMes.map(m => m.total), backgroundColor: cores.primaria, borderRadius: 4 }],
    },
    options: opcoesEixo(cores),
  });

  criarGrafico(container.querySelector('#g-status'), {
    type: 'doughnut',
    data: {
      labels: ['Pendentes', 'Atrasados', 'Devolvidos'],
      datasets: [{ data: [dados.statusEmprestimos.pendentes, dados.statusEmprestimos.atrasados, dados.statusEmprestimos.devolvidos], backgroundColor: [cores.aviso, cores.perigo, cores.sucesso] }],
    },
    options: opcoesRosca(cores),
  });

  criarGrafico(container.querySelector('#g-disponibilidade'), {
    type: 'doughnut',
    data: {
      labels: ['Disponíveis', 'Indisponíveis'],
      datasets: [{ data: [dados.disponibilidadeLivros.disponiveis, dados.disponibilidadeLivros.indisponiveis], backgroundColor: [cores.sucesso, cores.perigo] }],
    },
    options: opcoesRosca(cores),
  });

  criarGrafico(container.querySelector('#g-genero'), {
    type: 'bar',
    data: {
      labels: dados.livrosPorGenero.map(g => g.genero),
      datasets: [{ label: 'Livros', data: dados.livrosPorGenero.map(g => g.total), backgroundColor: PALETA, borderRadius: 4 }],
    },
    options: { ...opcoesEixo(cores), indexAxis: 'y' },
  });

  criarGrafico(container.querySelector('#g-uso-turma'), {
    type: 'bar',
    data: {
      labels: dados.usoPorTurma.map(t => t.turma),
      datasets: [{ label: 'Empréstimos', data: dados.usoPorTurma.map(t => t.total), backgroundColor: cores.primaria, borderRadius: 4 }],
    },
    options: opcoesEixo(cores),
  });

  criarGrafico(container.querySelector('#g-alunos-turma'), {
    type: 'bar',
    data: {
      labels: dados.alunosPorTurma.map(t => t.turma),
      datasets: [{ label: 'Alunos', data: dados.alunosPorTurma.map(t => t.total), backgroundColor: cores.sucesso, borderRadius: 4 }],
    },
    options: opcoesEixo(cores),
  });

  criarGrafico(container.querySelector('#g-top-livros'), {
    type: 'bar',
    data: {
      labels: dados.topLivros.map(l => l.titulo),
      datasets: [{ label: 'Empréstimos', data: dados.topLivros.map(l => l.total), backgroundColor: cores.primaria, borderRadius: 4 }],
    },
    options: { ...opcoesEixo(cores), indexAxis: 'y' },
  });

  criarGrafico(container.querySelector('#g-top-alunos'), {
    type: 'bar',
    data: {
      labels: dados.topAlunos.map(a => a.turma ? `${a.nome} (${a.turma})` : a.nome),
      datasets: [{ label: 'Empréstimos', data: dados.topAlunos.map(a => a.total), backgroundColor: cores.sucesso, borderRadius: 4 }],
    },
    options: { ...opcoesEixo(cores), indexAxis: 'y' },
  });

  if (temAuditoria) {
    criarGrafico(container.querySelector('#g-auditoria-acao'), {
      type: 'bar',
      data: {
        labels: dados.auditoria.porAcao.map(a => a.acao),
        datasets: [{ label: 'Ações', data: dados.auditoria.porAcao.map(a => a.total), backgroundColor: PALETA, borderRadius: 4 }],
      },
      options: opcoesEixo(cores),
    });

    criarGrafico(container.querySelector('#g-auditoria-usuario'), {
      type: 'bar',
      data: {
        labels: dados.auditoria.porUsuario.map(u => u.nome),
        datasets: [{ label: 'Ações', data: dados.auditoria.porUsuario.map(u => u.total), backgroundColor: cores.primaria, borderRadius: 4 }],
      },
      options: { ...opcoesEixo(cores), indexAxis: 'y' },
    });
  }
}
