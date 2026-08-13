import { api } from '../api.js';
import { escapeHtml, imprimirImagens } from '../utils.js';

const PALETA = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#9333ea', '#db2777', '#65a30d', '#0284c7', '#ea580c', '#4338ca', '#0f766e'];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rotuloMes(mesIso) {
  const [ano, mes] = mesIso.split('-');
  return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
}

function corVar(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
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

const ABAS = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'livros', rotulo: 'Livros' },
  { id: 'alunos', rotulo: 'Alunos' },
  { id: 'emprestimos', rotulo: 'Empréstimos' },
];

export default async function renderEstatisticas(container) {
  const dados = await api.get('/api/estatisticas');
  const temAuditoria = Boolean(dados.auditoria);
  const abas = temAuditoria ? [...ABAS, { id: 'administracao', rotulo: 'Administração' }] : ABAS;

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
      <button id="btn-imprimir" class="btn btn-secondary btn-sm">🖨️ Imprimir aba atual</button>
    </div>

    <div class="abas">
      ${abas.map((a, i) => `<button type="button" class="aba-btn ${i === 0 ? 'ativa' : ''}" data-aba="${a.id}">${a.rotulo}</button>`).join('')}
    </div>

    <div class="aba-conteudo" data-aba-conteudo="geral">
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
    </div>

    <div class="aba-conteudo hidden" data-aba-conteudo="livros">
      <div class="grid-graficos">
        <div class="painel">
          <h2>Livros por gênero</h2>
          <div class="sub">Quantidade no acervo</div>
          <div class="grafico-wrap alto"><canvas id="g-genero"></canvas></div>
        </div>
        <div class="painel">
          <h2>Gêneros mais emprestados</h2>
          <div class="sub">Por número de empréstimos</div>
          <div class="grafico-wrap alto"><canvas id="g-genero-emprestado"></canvas></div>
        </div>
      </div>

      <div class="grid-graficos">
        <div class="painel">
          <h2>Livros mais emprestados</h2>
          <div class="grafico-wrap alto"><canvas id="g-top-livros"></canvas></div>
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
    </div>

    <div class="aba-conteudo hidden" data-aba-conteudo="alunos">
      <div class="grid-graficos">
        <div class="painel">
          <h2>Alunos por turma</h2>
          <div class="grafico-wrap"><canvas id="g-alunos-turma"></canvas></div>
        </div>
        <div class="painel">
          <h2>Alunos que mais emprestam</h2>
          <div class="grafico-wrap alto"><canvas id="g-top-alunos"></canvas></div>
        </div>
      </div>

      ${dados.topAlunosPorPaginas.length ? `
        <div class="grid-graficos">
          <div class="painel">
            <h2>Alunos que mais leram</h2>
            <div class="sub">Soma de páginas dos livros emprestados</div>
            <div class="grafico-wrap alto"><canvas id="g-paginas-alunos"></canvas></div>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="aba-conteudo hidden" data-aba-conteudo="emprestimos">
      <div class="grid-graficos">
        <div class="painel">
          <h2>Empréstimos por mês</h2>
          <div class="sub">Últimos 12 meses</div>
          <div class="grafico-wrap alto"><canvas id="g-mes"></canvas></div>
        </div>
        <div class="painel">
          <h2>Uso da biblioteca por turma</h2>
          <div class="sub">Número de empréstimos</div>
          <div class="grafico-wrap alto"><canvas id="g-uso-turma"></canvas></div>
        </div>
      </div>
    </div>

    ${temAuditoria ? `
      <div class="aba-conteudo hidden" data-aba-conteudo="administracao">
        <div class="sub" style="margin-bottom:16px;">Últimos 30 dias</div>
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
      </div>
    ` : ''}
  `;

  // Chart.js não solta a referência do canvas sozinho quando o innerHTML da view é
  // trocado numa nova navegação — guardamos as instâncias pra destruir explicitamente
  // antes de recriar, evitando vazamento de memória ao entrar e sair da tela.
  let graficosAtivos = [];
  function criarGrafico(id, config) {
    const canvas = container.querySelector(`#${id}`);
    if (canvas) graficosAtivos.push(new Chart(canvas, config));
  }

  // Um canvas dentro de uma aba escondida (display:none) tem largura zero — por isso
  // os gráficos de cada aba só são criados na primeira vez que ela é aberta, depois
  // que a classe "hidden" já foi removida do container.
  const abasIniciadas = new Set();
  function criarGraficosDaAba(aba) {
    if (abasIniciadas.has(aba)) return;
    abasIniciadas.add(aba);

    if (aba === 'geral') {
      criarGrafico('g-status', {
        type: 'doughnut',
        data: {
          labels: ['Pendentes', 'Atrasados', 'Devolvidos'],
          datasets: [{ data: [dados.statusEmprestimos.pendentes, dados.statusEmprestimos.atrasados, dados.statusEmprestimos.devolvidos], backgroundColor: [cores.aviso, cores.perigo, cores.sucesso] }],
        },
        options: opcoesRosca(cores),
      });
      criarGrafico('g-disponibilidade', {
        type: 'doughnut',
        data: {
          labels: ['Disponíveis', 'Indisponíveis'],
          datasets: [{ data: [dados.disponibilidadeLivros.disponiveis, dados.disponibilidadeLivros.indisponiveis], backgroundColor: [cores.sucesso, cores.perigo] }],
        },
        options: opcoesRosca(cores),
      });
    }

    if (aba === 'livros') {
      criarGrafico('g-genero', {
        type: 'bar',
        data: {
          labels: dados.livrosPorGenero.map(g => g.genero),
          datasets: [{ label: 'Livros', data: dados.livrosPorGenero.map(g => g.total), backgroundColor: PALETA, borderRadius: 4 }],
        },
        options: { ...opcoesEixo(cores), indexAxis: 'y' },
      });
      criarGrafico('g-genero-emprestado', {
        type: 'bar',
        data: {
          labels: dados.generosMaisEmprestados.map(g => g.genero),
          datasets: [{ label: 'Empréstimos', data: dados.generosMaisEmprestados.map(g => g.total), backgroundColor: PALETA, borderRadius: 4 }],
        },
        options: { ...opcoesEixo(cores), indexAxis: 'y' },
      });
      criarGrafico('g-top-livros', {
        type: 'bar',
        data: {
          labels: dados.topLivros.map(l => l.titulo),
          datasets: [{ label: 'Empréstimos', data: dados.topLivros.map(l => l.total), backgroundColor: cores.primaria, borderRadius: 4 }],
        },
        options: { ...opcoesEixo(cores), indexAxis: 'y' },
      });
    }

    if (aba === 'alunos') {
      criarGrafico('g-alunos-turma', {
        type: 'bar',
        data: {
          labels: dados.alunosPorTurma.map(t => t.turma),
          datasets: [{ label: 'Alunos', data: dados.alunosPorTurma.map(t => t.total), backgroundColor: cores.sucesso, borderRadius: 4 }],
        },
        options: opcoesEixo(cores),
      });
      criarGrafico('g-top-alunos', {
        type: 'bar',
        data: {
          labels: dados.topAlunos.map(a => a.turma ? `${a.nome} (${a.turma})` : a.nome),
          datasets: [{ label: 'Empréstimos', data: dados.topAlunos.map(a => a.total), backgroundColor: cores.sucesso, borderRadius: 4 }],
        },
        options: { ...opcoesEixo(cores), indexAxis: 'y' },
      });
      if (dados.topAlunosPorPaginas.length) {
        criarGrafico('g-paginas-alunos', {
          type: 'bar',
          data: {
            labels: dados.topAlunosPorPaginas.map(a => a.turma ? `${a.nome} (${a.turma})` : a.nome),
            datasets: [{ label: 'Páginas', data: dados.topAlunosPorPaginas.map(a => a.paginas), backgroundColor: cores.aviso, borderRadius: 4 }],
          },
          options: { ...opcoesEixo(cores), indexAxis: 'y' },
        });
      }
    }

    if (aba === 'emprestimos') {
      criarGrafico('g-mes', {
        type: 'bar',
        data: {
          labels: dados.emprestimosPorMes.map(m => rotuloMes(m.mes)),
          datasets: [{ label: 'Empréstimos', data: dados.emprestimosPorMes.map(m => m.total), backgroundColor: cores.primaria, borderRadius: 4 }],
        },
        options: opcoesEixo(cores),
      });
      criarGrafico('g-uso-turma', {
        type: 'bar',
        data: {
          labels: dados.usoPorTurma.map(t => t.turma),
          datasets: [{ label: 'Empréstimos', data: dados.usoPorTurma.map(t => t.total), backgroundColor: cores.primaria, borderRadius: 4 }],
        },
        options: opcoesEixo(cores),
      });
    }

    if (aba === 'administracao' && temAuditoria) {
      criarGrafico('g-auditoria-acao', {
        type: 'bar',
        data: {
          labels: dados.auditoria.porAcao.map(a => a.acao),
          datasets: [{ label: 'Ações', data: dados.auditoria.porAcao.map(a => a.total), backgroundColor: PALETA, borderRadius: 4 }],
        },
        options: opcoesEixo(cores),
      });
      criarGrafico('g-auditoria-usuario', {
        type: 'bar',
        data: {
          labels: dados.auditoria.porUsuario.map(u => u.nome),
          datasets: [{ label: 'Ações', data: dados.auditoria.porUsuario.map(u => u.total), backgroundColor: cores.primaria, borderRadius: 4 }],
        },
        options: { ...opcoesEixo(cores), indexAxis: 'y' },
      });
    }
  }

  container.querySelectorAll('.aba-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.aba-btn').forEach(b => b.classList.toggle('ativa', b === btn));
      container.querySelectorAll('[data-aba-conteudo]').forEach(secao => {
        secao.classList.toggle('hidden', secao.dataset.abaConteudo !== btn.dataset.aba);
      });
      criarGraficosDaAba(btn.dataset.aba);
    });
  });

  container.querySelector('#btn-imprimir').addEventListener('click', () => {
    const abaAtiva = container.querySelector('.aba-btn.ativa');
    const painelAtivo = container.querySelector('[data-aba-conteudo]:not(.hidden)');
    const imagens = [...painelAtivo.querySelectorAll('.painel')].map(painel => ({
      titulo: painel.querySelector('h2')?.textContent || '',
      dataUrl: painel.querySelector('canvas')?.toDataURL('image/png'),
    })).filter(img => img.dataUrl);

    if (!imagens.length) {
      return;
    }
    imprimirImagens('Estatísticas', imagens, abaAtiva?.textContent || '');
  });

  criarGraficosDaAba('geral');
}
