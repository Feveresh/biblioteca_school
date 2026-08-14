import { api, getUsuario } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar } from '../utils.js';

const NOMES_CATEGORIA = {
  livros: 'Livros',
  alunos: 'Alunos',
  emprestimos: 'Empréstimos',
  administracao: 'Administração',
};

function temPermissao(usuario, codigo) {
  return usuario?.papel?.acessoTotal || usuario?.permissoes?.includes(codigo);
}

export default async function renderGestaoUsuarios(container) {
  const usuario = getUsuario();
  const abas = [];
  if (temPermissao(usuario, 'usuarios.gerenciar')) abas.push({ id: 'usuarios', rotulo: 'Usuários', render: renderAbaUsuarios });
  if (temPermissao(usuario, 'papeis.gerenciar')) abas.push({ id: 'papeis', rotulo: 'Papéis', render: renderAbaPapeis });

  if (!abas.length) {
    container.innerHTML = '<p class="mensagem-erro">Sem permissão para esta página.</p>';
    return;
  }

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Gestão de Usuários</h1>
        <div class="sub">Quem tem acesso ao sistema e o que cada um pode fazer</div>
      </div>
    </div>
    ${abas.length > 1 ? `
      <div class="abas">
        ${abas.map((a, i) => `<button class="aba-btn ${i === 0 ? 'ativa' : ''}" data-aba="${a.id}">${a.rotulo}</button>`).join('')}
      </div>
    ` : ''}
    <div id="conteudo-aba"></div>
  `;

  const conteudoAba = container.querySelector('#conteudo-aba');

  async function mostrarAba(id) {
    container.querySelectorAll('.aba-btn').forEach(b => b.classList.toggle('ativa', b.dataset.aba === id));
    const aba = abas.find(a => a.id === id);
    await aba.render(conteudoAba);
  }

  container.querySelectorAll('.aba-btn').forEach(btn => {
    btn.addEventListener('click', () => mostrarAba(btn.dataset.aba));
  });

  await mostrarAba(abas[0].id);
}

// ---------- Aba Usuários ----------
async function renderAbaUsuarios(container) {
  container.innerHTML = `
    <div class="toolbar" style="justify-content:flex-end;">
      <button id="btn-novo-usuario" class="btn btn-primary">+ Novo usuário</button>
    </div>
    <div class="tabela-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Email</th><th>Papel</th><th>Status</th><th></th></tr></thead>
        <tbody id="tbody-usuarios"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#tbody-usuarios');
  let papeis = [];

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="5" class="celula-vazia">Carregando…</td></tr>`;
    const usuarios = await api.get('/api/usuarios');
    if (!usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="celula-vazia">Nenhum usuário encontrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td>${escapeHtml(u.nome)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.papel_nome)}</td>
        <td>${u.ativo ? '<span class="badge badge-sucesso">Ativo</span>' : '<span class="badge badge-neutro">Inativo</span>'}</td>
        <td class="tabela-acoes">
          <button class="btn btn-secondary btn-sm" data-editar="${u.id}">Editar</button>
          <button class="btn btn-secondary btn-sm" data-senha="${u.id}">Redefinir senha</button>
          <button class="btn ${u.ativo ? 'btn-danger' : 'btn-primary'} btn-sm" data-status="${u.id}" data-ativo="${u.ativo}">${u.ativo ? 'Desativar' : 'Ativar'}</button>
        </td>
      </tr>
    `).join('');
  }

  function opcoesPapel(selecionado) {
    return papeis.map(p => `<option value="${p.id}" ${p.id === selecionado ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('');
  }

  function abrirFormulario(usuario) {
    const editando = Boolean(usuario);
    const corpo = abrirModal(editando ? 'Editar usuário' : 'Novo usuário', `
      <form id="form-usuario">
        <div class="campo">
          <label for="f-nome">Nome</label>
          <input id="f-nome" required value="${usuario ? escapeHtml(usuario.nome) : ''}">
        </div>
        <div class="campo">
          <label for="f-email">Email</label>
          <input type="email" id="f-email" required value="${usuario ? escapeHtml(usuario.email) : ''}">
        </div>
        ${!editando ? `
        <div class="campo">
          <label for="f-senha">Senha</label>
          <input type="password" id="f-senha" required minlength="6">
        </div>` : ''}
        <div class="campo">
          <label for="f-papel">Papel</label>
          <select id="f-papel" required>${opcoesPapel(usuario ? usuario.papel_id : null)}</select>
        </div>
        <p id="form-usuario-erro" class="mensagem-erro hidden"></p>
        <div class="modal-acoes">
          <button type="button" class="btn btn-secondary" id="cancelar-usuario">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    `);

    corpo.querySelector('#cancelar-usuario').addEventListener('click', fecharModal);
    corpo.querySelector('#form-usuario').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = corpo.querySelector('#form-usuario-erro');
      erroEl.classList.add('hidden');
      const dados = {
        nome: corpo.querySelector('#f-nome').value.trim(),
        email: corpo.querySelector('#f-email').value.trim(),
        role_id: Number(corpo.querySelector('#f-papel').value),
      };
      if (!editando) dados.senha = corpo.querySelector('#f-senha').value;
      try {
        if (editando) {
          await api.put(`/api/usuarios/${usuario.id}`, dados);
          mostrarToast('Usuário atualizado.', 'sucesso');
        } else {
          await api.post('/api/usuarios', dados);
          mostrarToast('Usuário cadastrado.', 'sucesso');
        }
        fecharModal();
        carregar();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  function abrirRedefinirSenha(id) {
    const corpo = abrirModal('Redefinir senha', `
      <form id="form-senha">
        <div class="campo">
          <label for="f-nova-senha">Nova senha</label>
          <input type="password" id="f-nova-senha" required minlength="6">
        </div>
        <p id="form-senha-erro" class="mensagem-erro hidden"></p>
        <div class="modal-acoes">
          <button type="button" class="btn btn-secondary" id="cancelar-senha">Cancelar</button>
          <button type="submit" class="btn btn-primary">Redefinir</button>
        </div>
      </form>
    `);
    corpo.querySelector('#cancelar-senha').addEventListener('click', fecharModal);
    corpo.querySelector('#form-senha').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = corpo.querySelector('#form-senha-erro');
      erroEl.classList.add('hidden');
      try {
        await api.post(`/api/usuarios/${id}/senha`, { senha: corpo.querySelector('#f-nova-senha').value });
        mostrarToast('Senha redefinida.', 'sucesso');
        fecharModal();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  container.querySelector('#btn-novo-usuario').addEventListener('click', () => abrirFormulario(null));

  tbody.addEventListener('click', async (e) => {
    const idEditar = e.target.dataset.editar;
    const idSenha = e.target.dataset.senha;
    const idStatus = e.target.dataset.status;

    if (idEditar) {
      const usuario = await api.get(`/api/usuarios/${idEditar}`);
      abrirFormulario(usuario);
    }
    if (idSenha) {
      abrirRedefinirSenha(idSenha);
    }
    if (idStatus) {
      const ativoAtual = e.target.dataset.ativo === 'true';
      const ok = await confirmar(`Tem certeza que deseja ${ativoAtual ? 'desativar' : 'ativar'} este usuário?`, {
        titulo: ativoAtual ? 'Desativar usuário' : 'Ativar usuário',
        textoConfirmar: ativoAtual ? 'Desativar' : 'Ativar',
        perigo: ativoAtual,
      });
      if (!ok) return;
      try {
        await api.patch(`/api/usuarios/${idStatus}/status`, { ativo: !ativoAtual });
        mostrarToast(`Usuário ${ativoAtual ? 'desativado' : 'ativado'}.`, 'sucesso');
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  papeis = await api.get('/api/papeis');
  await carregar();
}

// ---------- Aba Papéis ----------
async function renderAbaPapeis(container) {
  container.innerHTML = `
    <div class="toolbar" style="justify-content:flex-end;">
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
        <div class="grupo-permissoes-itens">
          ${permissoes.map(perm => `
            <label class="toggle">
              <input type="checkbox" name="permissao" value="${perm.codigo}" ${permissoesSelecionadas.includes(perm.codigo) ? 'checked' : ''}>
              <span class="toggle-trilho"></span>
              <span class="toggle-texto">${escapeHtml(perm.descricao)}</span>
            </label>
          `).join('')}
        </div>
      </fieldset>
    `).join('');
  }

  function abrirFormulario(papel) {
    const editando = Boolean(papel);
    const acessoTotal = Boolean(papel?.acesso_total);
    const corpo = abrirModal(editando ? 'Editar papel' : 'Novo papel', `
      <form id="form-papel">
        <div class="modal-grade">
          <div class="campo">
            <label for="f-nome">Nome</label>
            <input id="f-nome" required value="${papel ? escapeHtml(papel.nome) : ''}">
          </div>
          <div class="campo">
            <label for="f-descricao">Descrição</label>
            <input id="f-descricao" value="${papel && papel.descricao ? escapeHtml(papel.descricao) : ''}">
          </div>
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
    `, { grande: true });

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
