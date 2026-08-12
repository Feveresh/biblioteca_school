import { getToken, getUsuario, salvarSessao, limparSessao, api } from './api.js';
import { mostrarToast } from './utils.js';
import renderDashboard from './views/dashboard.js';
import renderLivros from './views/livros.js';
import renderAlunos from './views/alunos.js';
import renderEmprestimos from './views/emprestimos.js';
import renderUsuarios from './views/usuarios.js';
import renderPapeis from './views/papeis.js';
import renderAuditoria from './views/auditoria.js';
import renderConfiguracoes from './views/configuracoes.js';
import { carregarIdentidadeVisual } from './identidadeVisual.js';

const telaLogin = document.getElementById('tela-login');
const appEl = document.getElementById('app');
const viewEl = document.getElementById('view');
const formLogin = document.getElementById('form-login');
const loginErro = document.getElementById('login-erro');

const ROTAS = {
  '/': renderDashboard,
  '/livros': renderLivros,
  '/alunos': renderAlunos,
  '/emprestimos': renderEmprestimos,
  '/usuarios': renderUsuarios,
  '/papeis': renderPapeis,
  '/auditoria': renderAuditoria,
  '/configuracoes': renderConfiguracoes,
};

function temPermissao(usuario, codigo) {
  return usuario.papel?.acessoTotal || usuario.permissoes?.includes(codigo);
}

function mostrarApp() {
  telaLogin.classList.add('hidden');
  appEl.classList.remove('hidden');
  const usuario = getUsuario();
  if (usuario) {
    document.getElementById('user-nome').textContent = usuario.nome;
    document.getElementById('user-avatar').textContent = usuario.nome.charAt(0).toUpperCase();
    document.querySelectorAll('.nav-link[data-permissao]').forEach(link => {
      link.classList.toggle('hidden', !temPermissao(usuario, link.dataset.permissao));
    });
  }
  rotear();
}

function mostrarLogin() {
  appEl.classList.add('hidden');
  telaLogin.classList.remove('hidden');
  formLogin.reset();
}

async function rotear() {
  const caminho = location.hash.slice(1) || '/';
  const render = ROTAS[caminho] || renderDashboard;

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('ativo', link.dataset.rota === caminho);
  });

  viewEl.innerHTML = '<p style="color:var(--color-text-muted)">Carregando…</p>';
  try {
    await render(viewEl);
  } catch (err) {
    viewEl.innerHTML = `<p class="mensagem-erro">Não foi possível carregar esta página: ${err.message}</p>`;
  }
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErro.classList.add('hidden');
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const botao = formLogin.querySelector('button');
  botao.disabled = true;
  try {
    const { token, usuario } = await api.post('/api/auth/login', { email, senha });
    salvarSessao(token, usuario);
    mostrarApp();
  } catch (err) {
    loginErro.textContent = err.message;
    loginErro.classList.remove('hidden');
  } finally {
    botao.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try {
    await api.post('/api/auth/logout');
  } catch (err) {
    // mesmo se a chamada falhar (ex: sessão já inválida), a sessão local é limpa de qualquer forma
  }
  limparSessao();
  mostrarLogin();
});

window.addEventListener('sessao-expirada', () => {
  mostrarToast('Sessão expirada, faça login novamente.', 'erro');
  mostrarLogin();
});

window.addEventListener('hashchange', rotear);

carregarIdentidadeVisual();

if (getToken()) {
  mostrarApp();
} else {
  mostrarLogin();
}
