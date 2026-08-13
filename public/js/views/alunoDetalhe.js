import { api } from '../api.js';
import { escapeHtml, mostrarToast, formatarData, confirmar } from '../utils.js';

function badgeStatus(emprestimo) {
  if (emprestimo.status === 'devolvido') return '<span class="badge badge-neutro">Devolvido</span>';
  const hoje = new Date().toISOString().slice(0, 10);
  if (emprestimo.data_prevista.slice(0, 10) < hoje) return '<span class="badge badge-perigo">Atrasado</span>';
  return '<span class="badge badge-aviso">Pendente</span>';
}

export default async function renderAlunoDetalhe(container, { id }) {
  const [aluno, { dados: emprestimos }] = await Promise.all([
    api.get(`/api/alunos/${id}`),
    api.get(`/api/emprestimos?aluno_id=${id}&porPagina=500&ordenarPor=data_emprestimo&ordem=desc`),
  ]);

  const hoje = new Date().toISOString().slice(0, 10);
  const pendentes = emprestimos.filter(e => e.status === 'pendente');
  const atrasados = pendentes.filter(e => e.data_prevista.slice(0, 10) < hoje);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>${escapeHtml(aluno.nome)}</h1>
        <div class="sub">${aluno.turma_nome ? escapeHtml(aluno.turma_nome) + ' — ' : ''}Histórico de empréstimos</div>
      </div>
      <a href="#/alunos" class="btn btn-secondary">← Voltar para Alunos</a>
    </div>

    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-icone">📚</div>
        <div class="stat-valor">${emprestimos.length}</div>
        <div class="stat-label">Empréstimos no total</div>
      </div>
      <div class="stat-card aviso">
        <div class="stat-icone">⏳</div>
        <div class="stat-valor">${pendentes.length}</div>
        <div class="stat-label">Com o aluno agora</div>
      </div>
      <div class="stat-card perigo">
        <div class="stat-icone">⚠️</div>
        <div class="stat-valor">${atrasados.length}</div>
        <div class="stat-label">Atrasados</div>
      </div>
    </div>

    <div class="tabela-wrap">
      <table>
        <thead>
          <tr><th>Livro</th><th>Emprestado em</th><th>Previsto</th><th>Devolvido em</th><th>Status</th><th></th></tr>
        </thead>
        <tbody id="tbody-historico">
          ${emprestimos.length ? emprestimos.map(e => `
            <tr>
              <td>${escapeHtml(e.livro)} <span class="sub">(${escapeHtml(e.tombo)})</span></td>
              <td>${formatarData(e.data_emprestimo)}</td>
              <td>${formatarData(e.data_prevista)}</td>
              <td>${formatarData(e.data_devolucao)}</td>
              <td>${badgeStatus(e)}</td>
              <td class="tabela-acoes">
                ${e.status !== 'devolvido' ? `
                  <button class="btn btn-secondary btn-sm" data-renovar="${e.id}">Renovar</button>
                  <button class="btn btn-primary btn-sm" data-devolver="${e.id}">Devolver</button>
                ` : ''}
              </td>
            </tr>
          `).join('') : `<tr><td colspan="6" class="celula-vazia">Este aluno ainda não pegou nenhum livro emprestado.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#tbody-historico').addEventListener('click', async (e) => {
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
        renderAlunoDetalhe(container, { id });
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }

    if (idRenovar) {
      const ok = await confirmar('Estender o prazo deste empréstimo?', {
        titulo: 'Renovar empréstimo', textoConfirmar: 'Renovar',
      });
      if (!ok) return;
      try {
        await api.patch(`/api/emprestimos/${idRenovar}/renovar`);
        mostrarToast('Empréstimo renovado.', 'sucesso');
        renderAlunoDetalhe(container, { id });
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });
}
