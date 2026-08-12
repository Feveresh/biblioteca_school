import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar } from '../utils.js';

const NOMES_CATEGORIA = {
  livros: 'Livros',
  alunos: 'Alunos',
  emprestimos: 'Empréstimos',
  administracao: 'Administração',
};

export default async function renderPapeis(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Papéis</h1>
        <div class="sub">Defina o que cada papel pode fazer no sistema</div>
      </div>
      <button id="btn-novo-papel" class="btn btn-primary">+ Novo papel</button>
    </div>
    <div class="tabela-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Descrição</th><th>Permissões</th><th></th></tr></thead>
        <tbody id="tbody-papeis"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#tbody-papeis');
  let catalogoPermissoes = [];

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="4" class="celula-vazia">Carregando…</td></tr>`;
    const papeis = await api.get('/api/papeis');
    if (!papeis.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="celula-vazia">Nenhum papel encontrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = papeis.map(p => `
      <tr>
        <td>${escapeHtml(p.nome)}</td>
        <td>${escapeHtml(p.descricao || '—')}</td>
        <td>${p.acesso_total ? '<span class="badge badge-sucesso">Acesso total</span>' : `${p.permissoes.length} permissão(ões)`}</td>
        <td class="tabela-acoes">
          <button class="btn btn-secondary btn-sm" data-editar="${p.id}">Editar</button>
          ${!p.sistema ? `<button class="btn btn-danger btn-sm" data-excluir="${p.id}">Excluir</button>` : ''}
        </td>
      </tr>
    `).join('');
  }

  function montarCheckboxes(permissoesSelecionadas) {
    const porCategoria = {};
    for (const perm of catalogoPermissoes) {
      (porCategoria[perm.categoria] ||= []).push(perm);
    }
    return Object.entries(porCategoria).map(([categoria, permissoes]) => `
      <fieldset class="grupo-permissoes">
        <legend>${NOMES_CATEGORIA[categoria] || escapeHtml(categoria)}</legend>
        ${permissoes.map(perm => `
          <label class="opcao-checkbox">
            <input type="checkbox" name="permissao" value="${perm.codigo}" ${permissoesSelecionadas.includes(perm.codigo) ? 'checked' : ''}>
            ${escapeHtml(perm.descricao)}
          </label>
        `).join('')}
      </fieldset>
    `).join('');
  }

  function abrirFormulario(papel) {
    const editando = Boolean(papel);
    const acessoTotal = Boolean(papel?.acesso_total);
    const corpo = abrirModal(editando ? 'Editar papel' : 'Novo papel', `
      <form id="form-papel">
        <div class="campo">
          <label for="f-nome">Nome</label>
          <input id="f-nome" required value="${papel ? escapeHtml(papel.nome) : ''}">
        </div>
        <div class="campo">
          <label for="f-descricao">Descrição</label>
          <input id="f-descricao" value="${papel && papel.descricao ? escapeHtml(papel.descricao) : ''}">
        </div>
        ${acessoTotal
          ? '<p class="sub">Este papel tem <strong>acesso total</strong> ao sistema — não é possível restringir permissões individuais.</p>'
          : `<div class="campo"><label>Permissões</label>${montarCheckboxes(papel ? papel.permissoes : [])}</div>`}
        <p id="form-papel-erro" class="mensagem-erro hidden"></p>
        <div class="modal-acoes">
          <button type="button" class="btn btn-secondary" id="cancelar-papel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    `);

    corpo.querySelector('#cancelar-papel').addEventListener('click', fecharModal);
    corpo.querySelector('#form-papel').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = corpo.querySelector('#form-papel-erro');
      erroEl.classList.add('hidden');
      const dados = {
        nome: corpo.querySelector('#f-nome').value.trim(),
        descricao: corpo.querySelector('#f-descricao').value.trim() || null,
        permissoes: acessoTotal
          ? []
          : Array.from(corpo.querySelectorAll('input[name="permissao"]:checked')).map(el => el.value),
      };
      try {
        if (editando) {
          await api.put(`/api/papeis/${papel.id}`, dados);
          mostrarToast('Papel atualizado.', 'sucesso');
        } else {
          await api.post('/api/papeis', dados);
          mostrarToast('Papel cadastrado.', 'sucesso');
        }
        fecharModal();
        carregar();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  container.querySelector('#btn-novo-papel').addEventListener('click', () => abrirFormulario(null));

  tbody.addEventListener('click', async (e) => {
    const idEditar = e.target.dataset.editar;
    const idExcluir = e.target.dataset.excluir;
    if (idEditar) {
      const papel = await api.get(`/api/papeis/${idEditar}`);
      abrirFormulario(papel);
    }
    if (idExcluir) {
      const ok = await confirmar('Tem certeza que deseja excluir este papel?', {
        titulo: 'Excluir papel', textoConfirmar: 'Excluir', perigo: true,
      });
      if (!ok) return;
      try {
        await api.delete(`/api/papeis/${idExcluir}`);
        mostrarToast('Papel removido.', 'sucesso');
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  catalogoPermissoes = await api.get('/api/permissoes');
  await carregar();
}
