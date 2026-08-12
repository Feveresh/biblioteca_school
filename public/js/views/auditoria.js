import { api } from '../api.js';
import { escapeHtml, abrirModal, fecharModal } from '../utils.js';

const NOMES_ENTIDADE = {
  livros: 'Livros', alunos: 'Alunos', emprestimos: 'Empréstimos',
  usuarios: 'Usuários', papeis: 'Papéis', configuracoes: 'Configurações', auth: 'Autenticação',
};

function formatarDataHora(iso) {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR');
}

export default async function renderAuditoria(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Auditoria</h1>
        <div class="sub">Registro de tudo que foi criado, alterado ou removido no sistema</div>
      </div>
    </div>

    <div class="toolbar">
      <select id="f-entidade">
        <option value="">Todas as entidades</option>
        ${Object.entries(NOMES_ENTIDADE).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      <select id="f-acao">
        <option value="">Todas as ações</option>
        <option value="criar">Criar</option>
        <option value="atualizar">Atualizar</option>
        <option value="excluir">Excluir</option>
        <option value="login">Login</option>
        <option value="logout">Logout</option>
        <option value="devolver">Devolver</option>
        <option value="ativar">Ativar</option>
        <option value="desativar">Desativar</option>
        <option value="redefinir_senha">Redefinir senha</option>
      </select>
      <input type="date" id="f-de" title="De">
      <input type="date" id="f-ate" title="Até">
      <button id="btn-filtrar" class="btn btn-secondary btn-sm">Filtrar</button>
      <button id="btn-limpar" class="btn btn-secondary btn-sm">Limpar</button>
    </div>

    <div class="tabela-wrap">
      <table>
        <thead><tr><th>Quando</th><th>Usuário</th><th>Entidade</th><th>Ação</th><th>ID</th><th></th></tr></thead>
        <tbody id="tbody-auditoria"></tbody>
      </table>
    </div>

    <div class="toolbar" id="paginacao" style="justify-content:flex-end;margin-top:14px;"></div>
  `;

  const tbody = container.querySelector('#tbody-auditoria');
  const paginacaoEl = container.querySelector('#paginacao');
  let pagina = 1;
  const porPagina = 30;

  function construirQuery() {
    const params = new URLSearchParams({ pagina, porPagina });
    const entidade = container.querySelector('#f-entidade').value;
    const acao = container.querySelector('#f-acao').value;
    const de = container.querySelector('#f-de').value;
    const ate = container.querySelector('#f-ate').value;
    if (entidade) params.set('entidade', entidade);
    if (acao) params.set('acao', acao);
    if (de) params.set('de', de);
    if (ate) params.set('ate', ate);
    return params.toString();
  }

  function badgeAcao(acao) {
    if (acao === 'excluir' || acao === 'desativar') return `<span class="badge badge-perigo">${escapeHtml(acao)}</span>`;
    if (acao === 'criar' || acao === 'login' || acao === 'ativar') return `<span class="badge badge-sucesso">${escapeHtml(acao)}</span>`;
    return `<span class="badge badge-neutro">${escapeHtml(acao)}</span>`;
  }

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="6" class="celula-vazia">Carregando…</td></tr>`;
    const { dados, total } = await api.get(`/api/auditoria?${construirQuery()}`);

    if (!dados.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="celula-vazia">Nenhum registro encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = dados.map(l => `
        <tr>
          <td>${formatarDataHora(l.criado_em)}</td>
          <td>${l.usuario_nome ? escapeHtml(l.usuario_nome) : '<span class="sub">sistema</span>'}</td>
          <td>${NOMES_ENTIDADE[l.entidade] || escapeHtml(l.entidade)}</td>
          <td>${badgeAcao(l.acao)}</td>
          <td>${l.entidade_id ?? '—'}</td>
          <td class="tabela-acoes">
            ${(l.dados_antes || l.dados_depois) ? `<button class="btn btn-secondary btn-sm" data-detalhes="${l.id}">Ver detalhes</button>` : ''}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-detalhes]').forEach(btn => {
        // l.id vem como string: log_auditoria.id é BIGSERIAL e o driver `pg` retorna
        // bigint como string (evita perda de precisão em números > Number.MAX_SAFE_INTEGER).
        const registro = dados.find(l => String(l.id) === btn.dataset.detalhes);
        btn.addEventListener('click', () => {
          abrirModal('Detalhes do registro', `
            ${registro.dados_antes ? `<p><strong>Antes:</strong></p><pre>${escapeHtml(JSON.stringify(registro.dados_antes, null, 2))}</pre>` : ''}
            ${registro.dados_depois ? `<p><strong>Depois:</strong></p><pre>${escapeHtml(JSON.stringify(registro.dados_depois, null, 2))}</pre>` : ''}
            <div class="modal-acoes"><button type="button" class="btn btn-secondary" id="fechar-detalhes">Fechar</button></div>
          `);
          document.getElementById('fechar-detalhes').addEventListener('click', fecharModal);
        });
      });
    }

    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    paginacaoEl.innerHTML = `
      <button id="btn-anterior" class="btn btn-secondary btn-sm" ${pagina <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="sub">Página ${pagina} de ${totalPaginas} (${total} registro(s))</span>
      <button id="btn-proxima" class="btn btn-secondary btn-sm" ${pagina >= totalPaginas ? 'disabled' : ''}>Próxima →</button>
    `;
    paginacaoEl.querySelector('#btn-anterior').addEventListener('click', () => { pagina--; carregar(); });
    paginacaoEl.querySelector('#btn-proxima').addEventListener('click', () => { pagina++; carregar(); });
  }

  container.querySelector('#btn-filtrar').addEventListener('click', () => { pagina = 1; carregar(); });
  container.querySelector('#btn-limpar').addEventListener('click', () => {
    container.querySelector('#f-entidade').value = '';
    container.querySelector('#f-acao').value = '';
    container.querySelector('#f-de').value = '';
    container.querySelector('#f-ate').value = '';
    pagina = 1;
    carregar();
  });

  await carregar();
}
