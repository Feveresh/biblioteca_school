import { api } from '../api.js';
import { escapeHtml, formatarData } from '../utils.js';

export default async function renderDashboard(container) {
  const dados = await api.get('/api/dashboard');

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Dashboard</h1>
        <div class="sub">Visão geral da biblioteca</div>
      </div>
    </div>

    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-icone">📚</div>
        <div class="stat-valor">${dados.livros.total}</div>
        <div class="stat-label">Livros no acervo</div>
      </div>
      <div class="stat-card sucesso">
        <div class="stat-icone">✅</div>
        <div class="stat-valor">${dados.livros.disponiveis}</div>
        <div class="stat-label">Disponíveis</div>
      </div>
      <div class="stat-card">
        <div class="stat-icone">📤</div>
        <div class="stat-valor">${dados.livros.emprestados}</div>
        <div class="stat-label">Emprestados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icone">🎓</div>
        <div class="stat-valor">${dados.alunos.total}</div>
        <div class="stat-label">Alunos cadastrados</div>
      </div>
      <div class="stat-card aviso">
        <div class="stat-icone">⏳</div>
        <div class="stat-valor">${dados.emprestimos.pendentes}</div>
        <div class="stat-label">Empréstimos pendentes</div>
      </div>
      <div class="stat-card perigo">
        <div class="stat-icone">⚠️</div>
        <div class="stat-valor">${dados.emprestimos.atrasados}</div>
        <div class="stat-label">Empréstimos atrasados</div>
      </div>
    </div>

    <div class="painel">
      <h2>Últimos empréstimos</h2>
      <div class="tabela-wrap" style="box-shadow:none;border:none;">
        <table>
          <thead><tr><th>Aluno</th><th>Livro</th><th>Emprestado em</th><th>Previsto</th><th>Status</th></tr></thead>
          <tbody>
            ${dados.ultimosEmprestimos.length ? dados.ultimosEmprestimos.map(e => `
              <tr>
                <td>${escapeHtml(e.aluno)}</td>
                <td>${escapeHtml(e.livro)}</td>
                <td>${formatarData(e.data_emprestimo)}</td>
                <td>${formatarData(e.data_prevista)}</td>
                <td>${e.status === 'devolvido' ? '<span class="badge badge-neutro">Devolvido</span>' : '<span class="badge badge-aviso">Pendente</span>'}</td>
              </tr>
            `).join('') : `<tr><td colspan="5" class="celula-vazia">Nenhum empréstimo registrado ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
