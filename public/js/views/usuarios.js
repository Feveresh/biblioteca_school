import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar } from '../utils.js';

export default async function renderUsuarios(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Usuários</h1>
        <div class="sub">Quem tem acesso ao sistema</div>
      </div>
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
