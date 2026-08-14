import { api } from './api.js';
import { abrirModal, fecharModal, mostrarToast } from './utils.js';

const overlay = document.getElementById('atualizacao-overlay');
const spinner = document.getElementById('atualizacao-spinner');
const tituloEl = document.getElementById('atualizacao-titulo');
const mensagemEl = document.getElementById('atualizacao-mensagem');
const barraPreenchida = document.getElementById('atualizacao-barra-preenchida');
const btnFechar = document.getElementById('atualizacao-btn-fechar');
const btnRodape = document.getElementById('sidebar-btn-atualizar');

const ROTULO_FASE = {
  baixando: (p) => `Baixando atualização… ${p ?? 0}%`,
  instalando: () => 'Instalando…',
  reiniciando: () => 'Reiniciando o sistema…',
};

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function consultarStatus() {
  try {
    const resp = await fetch('/api/atualizacao/status');
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null; // servidor inalcançável agora (normal durante o reinício do serviço)
  }
}

function exibirEstadoNaTela(estado) {
  if (estado.fase === 'erro') {
    spinner.classList.add('hidden');
    tituloEl.textContent = 'Não foi possível atualizar';
    mensagemEl.textContent = estado.erro || 'Erro desconhecido.';
    barraPreenchida.style.width = '0%';
    btnFechar.classList.remove('hidden');
    return;
  }
  spinner.classList.remove('hidden');
  btnFechar.classList.add('hidden');
  tituloEl.textContent = `Atualizando para a versão ${estado.versao || ''}`.trim();
  mensagemEl.textContent = (ROTULO_FASE[estado.fase] || (() => 'Preparando…'))(estado.progresso);
  barraPreenchida.style.width = `${estado.fase === 'baixando' ? (estado.progresso ?? 0) : 100}%`;
}

function mostrarConcluido() {
  spinner.classList.add('hidden');
  tituloEl.textContent = 'Atualização concluída!';
  mensagemEl.textContent = 'Recarregando…';
  barraPreenchida.style.width = '100%';
}

let acompanhando = false;

// Loop de checagem: enquanto a atualização estiver em andamento, mantém a tela fixa aberta
// e vai atualizando a fase/progresso. Falha de rede durante o loop é esperada (o serviço
// reinicia no meio do processo) — só é tratada como "terminou" quando o servidor volta a
// responder E diz que não está mais atualizando.
async function acompanharAteTerminar() {
  if (acompanhando) return;
  acompanhando = true;
  overlay.classList.remove('hidden');

  while (true) {
    const estado = await consultarStatus();
    if (estado && estado.atualizando) {
      exibirEstadoNaTela(estado);
    } else if (estado && !estado.atualizando) {
      mostrarConcluido();
      await esperar(1200);
      location.reload();
      return;
    }
    // estado === null: servidor fora do ar agora, continua tentando sem mudar a mensagem
    await esperar(1500);
  }
}

btnFechar.addEventListener('click', async () => {
  try {
    await api.post('/api/atualizacao/limpar-erro');
  } catch {
    // segue mesmo se falhar — a tela fecha de qualquer forma
  }
  overlay.classList.add('hidden');
  acompanhando = false;
});

// Chamado uma vez, bem no início do carregamento da página (antes de decidir se mostra
// login ou app) — cobre o caso "abri uma aba nova enquanto uma atualização já estava
// rolando". Poucas tentativas rápidas: se o servidor não responder logo, assume que não
// há atualização em andamento (só uma indisponibilidade comum) e segue o carregamento normal.
export async function verificarNoCarregamento() {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const estado = await consultarStatus();
    if (estado?.atualizando) {
      acompanharAteTerminar();
      return true;
    }
    if (estado) return false; // respondeu e não há atualização — segue o fluxo normal
    await esperar(800);
  }
  return false;
}

async function dispararAtualizacao() {
  try {
    await api.post('/api/atualizacao/iniciar');
    acompanharAteTerminar();
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
}

// Chamado depois de um login bem-sucedido, só para quem tem permissão de administração.
export async function verificarNoLogin() {
  let disponivel;
  try {
    disponivel = await api.get('/api/atualizacao/verificar');
  } catch {
    return;
  }
  if (!disponivel.temAtualizacao) return;

  mostrarBotaoRodape(disponivel);

  const corpo = abrirModal('Nova versão disponível', `
    <p>Uma nova versão do sistema está disponível: <strong>v${disponivel.versaoDisponivel}</strong>
    (versão atual: v${disponivel.versaoAtual}).</p>
    ${disponivel.notas ? `<p class="sub">${disponivel.notas}</p>` : ''}
    <div class="modal-acoes">
      <button type="button" class="btn btn-secondary" id="btn-atualizar-depois">Depois</button>
      <button type="button" class="btn btn-primary" id="btn-atualizar-agora">Atualizar</button>
    </div>
  `);
  corpo.querySelector('#btn-atualizar-depois').addEventListener('click', fecharModal);
  corpo.querySelector('#btn-atualizar-agora').addEventListener('click', () => {
    fecharModal();
    dispararAtualizacao();
  });
}

function mostrarBotaoRodape(disponivel) {
  btnRodape.textContent = `Atualizar p/ v${disponivel.versaoDisponivel}`;
  btnRodape.classList.remove('hidden');
  btnRodape.onclick = () => dispararAtualizacao();
}
