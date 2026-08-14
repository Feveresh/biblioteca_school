import { api, getUsuario } from '../api.js';
import { mostrarToast, escapeHtml, debounce, confirmar } from '../utils.js';
import { aplicarIdentidadeVisual, atualizarCacheIdentidadeVisual } from '../identidadeVisual.js';
import { temaAtual, alternarTema } from '../tema.js';

const TAMANHO_MAX_LOGO = 150 * 1024;
const MIMES_PERMITIDOS = ['image/png', 'image/jpeg', 'image/svg+xml'];

const CORES = [
  { campo: 'cor_primaria', id: 'f-cor-primaria', rotulo: 'Cor principal' },
  { campo: 'cor_menu', id: 'f-cor-menu', rotulo: 'Menu (barra lateral)' },
  { campo: 'cor_login', id: 'f-cor-login', rotulo: 'Tela de login' },
  { campo: 'cor_botoes', id: 'f-cor-botoes', rotulo: 'Botões' },
];

const ABAS = [
  { id: 'geral', rotulo: 'Geral' },
  { id: 'visual', rotulo: 'Visual' },
  { id: 'administracao', rotulo: 'Administração' },
];

function temPermissao(usuario, codigo) {
  return usuario?.papel?.acessoTotal || usuario?.permissoes?.includes(codigo);
}

function lerArquivoComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

export default async function renderConfiguracoes(container) {
  const usuario = getUsuario();
  const podeEditar = temPermissao(usuario, 'configuracoes.gerenciar');
  const config = await api.get('/api/configuracoes');
  const desabilitado = podeEditar ? '' : 'disabled';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Configurações</h1>
        <div class="sub">${podeEditar ? 'Ajustes gerais da biblioteca' : 'Ajustes gerais da biblioteca (somente leitura)'}</div>
      </div>
    </div>

    <div class="abas">
      ${ABAS.map((a, i) => `<button type="button" class="aba-btn ${i === 0 ? 'ativa' : ''}" data-aba="${a.id}">${a.rotulo}</button>`).join('')}
    </div>

    <div id="form-configuracoes">
      <div class="aba-conteudo" data-aba-conteudo="geral">
        <div class="painel">
          <div class="form-linha">
            <div class="campo">
              <label for="f-nome">Nome da biblioteca</label>
              <input id="f-nome" required value="${escapeHtml(config.nome_biblioteca)}" ${desabilitado}>
            </div>
            <div class="campo">
              <label for="f-dias">Dias de empréstimo (padrão)</label>
              <input type="number" id="f-dias" min="1" required value="${config.dias_emprestimo_padrao}" ${desabilitado}>
            </div>
            <div class="campo">
              <label for="f-limite">Limite de livros por aluno</label>
              <input type="number" id="f-limite" min="1" value="${config.limite_livros_por_aluno ?? ''}" placeholder="Sem limite" ${desabilitado}>
            </div>
          </div>
        </div>
      </div>

      <div class="aba-conteudo hidden" data-aba-conteudo="visual">
        <div class="painel">
          <h2>Cores</h2>
          <div class="form-linha">
            ${CORES.map(c => `
              <div class="campo">
                <label for="${c.id}">${c.rotulo}</label>
                <input type="color" id="${c.id}" value="${config[c.campo]}" ${desabilitado} style="height:42px;padding:4px;">
              </div>
            `).join('')}
          </div>
          <div class="form-linha">
            <div class="campo">
              <label for="f-logo">Logo (PNG, JPEG ou SVG, até 150KB)</label>
              <input type="file" id="f-logo" accept="image/png,image/jpeg,image/svg+xml" ${desabilitado}>
            </div>
            <div class="campo">
              <label>Prévia</label>
              <div id="logo-preview">${config.logo_data_url ? `<img src="${config.logo_data_url}" alt="Logo atual" style="max-height:88px;">` : '<span class="sub">Sem logo</span>'}</div>
            </div>
          </div>
          ${podeEditar ? '<button type="button" id="btn-remover-logo" class="btn btn-secondary btn-sm">Remover logo</button>' : ''}
        </div>

        <div class="painel">
          <h2>Tema</h2>
          <p class="sub" style="margin:0 0 14px;">Preferência pessoal deste navegador — não afeta outros usuários.</p>
          <button type="button" id="btn-tema" class="btn btn-secondary"></button>
        </div>
      </div>

      <div class="aba-conteudo hidden" data-aba-conteudo="administracao">
        <div class="painel">
          <h2>Segurança do login</h2>
          <div class="form-linha">
            <div class="campo">
              <label for="f-max-tentativas">Máx. tentativas de login</label>
              <input type="number" id="f-max-tentativas" min="1" required value="${config.login_max_tentativas}" ${desabilitado}>
            </div>
            <div class="campo">
              <label for="f-bloqueio">Minutos de bloqueio</label>
              <input type="number" id="f-bloqueio" min="1" required value="${config.login_bloqueio_minutos}" ${desabilitado}>
            </div>
            <div class="campo">
              <label for="f-retencao">Retenção da auditoria (dias)</label>
              <input type="number" id="f-retencao" min="1" required value="${config.auditoria_retencao_dias}" ${desabilitado}>
            </div>
          </div>
        </div>

        <div class="painel">
          <h2>Atualizações do sistema</h2>
          <p class="sub" style="margin:0 0 14px;">
            Endereço de um servidor que informa a versão mais recente disponível — checado a cada login
            (só para administradores). Em branco, o sistema nunca verifica nada pela rede.
          </p>
          <div class="campo">
            <label for="f-url-atualizacao">URL de verificação de atualização <span class="sub">(opcional)</span></label>
            <input id="f-url-atualizacao" placeholder="ex: http://localhost:4000/versao-mais-recente" value="${config.url_verificacao_atualizacao ? escapeHtml(config.url_verificacao_atualizacao) : ''}" ${desabilitado}>
          </div>
        </div>

        <div class="painel">
          <h2>Acesso pela rede</h2>
          <p class="sub" style="margin:0 0 14px;">Por padrão, o sistema só pode ser acessado por este computador. Ativando, outros computadores da mesma rede da escola também conseguem acessar pelo navegador.</p>
          <label class="toggle" style="font-weight:600;">
            <input type="checkbox" id="f-acesso-rede" ${config.permitir_acesso_rede ? 'checked' : ''} ${desabilitado}>
            <span class="toggle-trilho"></span>
            <span class="toggle-texto">Permitir acesso pela rede</span>
          </label>
          <div class="form-linha" style="margin-top:16px;">
            <div class="campo">
              <label>Este computador</label>
              <input value="${escapeHtml(config.enderecos.local)}" readonly>
            </div>
            <div class="campo">
              <label>Outros computadores da rede</label>
              <input value="${config.enderecos.rede ? escapeHtml(config.enderecos.rede) : 'Rede não detectada'}" readonly>
            </div>
          </div>
        </div>

        ${config.motorBanco === 'sqlite' && podeEditar ? `
          <div class="painel">
            <h2>Migrar para PostgreSQL</h2>
            <p class="sub" style="margin:0 0 14px;">
              O sistema está usando SQLite (arquivo local, sem instalação extra). Se a escola tiver um
              servidor PostgreSQL na rede — recomendado quando vários computadores acessam o sistema ao
              mesmo tempo — você pode migrar todos os dados pra lá. O SQLite só é apagado depois que a
              cópia é conferida com sucesso, e um backup de segurança é criado antes de apagar.
            </p>
            <div class="form-linha">
              <div class="campo" style="flex:1;">
                <label for="f-migracao-url">URL de conexão do PostgreSQL de destino</label>
                <input type="text" id="f-migracao-url" placeholder="postgresql://usuario:senha@host:5432/banco" autocomplete="off">
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              <button type="button" id="btn-migracao-testar" class="btn btn-secondary btn-sm">Testar conexão</button>
              <button type="button" id="btn-migracao-copiar" class="btn btn-secondary btn-sm">Copiar dados</button>
              <button type="button" id="btn-migracao-finalizar" class="btn btn-danger btn-sm" disabled>Finalizar migração</button>
            </div>
            <p id="migracao-status" class="sub" style="margin-top:10px;min-height:16px;"></p>
            <div id="migracao-relatorio"></div>
          </div>
        ` : ''}
      </div>

      <p id="config-erro" class="mensagem-erro hidden"></p>
      ${podeEditar ? '<p class="sub" id="config-status" style="min-height:16px;"></p>' : ''}
    </div>
  `;

  // Abas — só alternam visibilidade, os campos de todas continuam no mesmo salvamento automático
  container.querySelectorAll('.aba-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.aba-btn').forEach(b => b.classList.toggle('ativa', b === btn));
      container.querySelectorAll('[data-aba-conteudo]').forEach(secao => {
        secao.classList.toggle('hidden', secao.dataset.abaConteudo !== btn.dataset.aba);
      });
    });
  });

  // Tema — preferência pessoal do navegador, sempre interativa independente de permissão
  const btnTema = container.querySelector('#btn-tema');
  function atualizarBotaoTema() {
    btnTema.textContent = temaAtual() === 'dark' ? '☀️ Modo claro' : '🌙 Modo escuro';
  }
  btnTema.addEventListener('click', () => { alternarTema(); atualizarBotaoTema(); });
  atualizarBotaoTema();

  if (!podeEditar) return;

  let logoAtual = config.logo_data_url;
  const erroEl = container.querySelector('#config-erro');
  const statusEl = container.querySelector('#config-status');

  // Salva tudo junto (o backend espera o registro completo) sempre que algum campo muda —
  // sem botão de salvar. Campos de texto/número usam debounce pra não disparar uma
  // requisição a cada tecla; checkbox, cor, arquivo e "remover logo" salvam na hora,
  // já que são escolhas discretas, não digitação contínua.
  async function salvar() {
    erroEl.classList.add('hidden');

    const nome = container.querySelector('#f-nome').value.trim();
    if (!nome) {
      erroEl.textContent = 'O nome da biblioteca não pode ficar em branco.';
      erroEl.classList.remove('hidden');
      return;
    }

    const dados = {
      nome_biblioteca: nome,
      logo_data_url: logoAtual,
      dias_emprestimo_padrao: Number(container.querySelector('#f-dias').value),
      limite_livros_por_aluno: container.querySelector('#f-limite').value
        ? Number(container.querySelector('#f-limite').value) : null,
      login_max_tentativas: Number(container.querySelector('#f-max-tentativas').value),
      login_bloqueio_minutos: Number(container.querySelector('#f-bloqueio').value),
      auditoria_retencao_dias: Number(container.querySelector('#f-retencao').value),
      permitir_acesso_rede: container.querySelector('#f-acesso-rede').checked,
      url_verificacao_atualizacao: container.querySelector('#f-url-atualizacao').value.trim() || null,
    };
    CORES.forEach(c => { dados[c.campo] = container.querySelector(`#${c.id}`).value; });

    try {
      const atualizado = await api.put('/api/configuracoes', dados);
      aplicarIdentidadeVisual(atualizado);
      atualizarCacheIdentidadeVisual(atualizado);
      statusEl.textContent = '✓ Salvo';
      setTimeout(() => { if (statusEl.textContent === '✓ Salvo') statusEl.textContent = ''; }, 2000);
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.classList.remove('hidden');
    }
  }

  const salvarComDebounce = debounce(salvar, 700);

  container.querySelector('#f-logo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    if (!MIMES_PERMITIDOS.includes(arquivo.type)) {
      mostrarToast('Formato de imagem não suportado. Use PNG, JPEG ou SVG.', 'erro');
      e.target.value = '';
      return;
    }
    if (arquivo.size > TAMANHO_MAX_LOGO) {
      mostrarToast('Logo muito grande — o máximo é 150KB.', 'erro');
      e.target.value = '';
      return;
    }
    logoAtual = await lerArquivoComoDataUrl(arquivo);
    container.querySelector('#logo-preview').innerHTML = `<img src="${logoAtual}" alt="Prévia" style="max-height:88px;">`;
    salvar();
  });

  const btnRemoverLogo = container.querySelector('#btn-remover-logo');
  if (btnRemoverLogo) {
    btnRemoverLogo.addEventListener('click', () => {
      logoAtual = null;
      container.querySelector('#logo-preview').innerHTML = '<span class="sub">Sem logo</span>';
      container.querySelector('#f-logo').value = '';
      salvar();
    });
  }

  CORES.forEach(c => {
    container.querySelector(`#${c.id}`).addEventListener('input', (e) => {
      aplicarIdentidadeVisual({ [c.campo]: e.target.value });
      salvarComDebounce();
    });
  });

  ['#f-nome', '#f-dias', '#f-limite', '#f-max-tentativas', '#f-bloqueio', '#f-retencao', '#f-url-atualizacao'].forEach(seletor => {
    container.querySelector(seletor).addEventListener('input', salvarComDebounce);
  });

  container.querySelector('#f-acesso-rede').addEventListener('change', salvar);

  // Migração SQLite → PostgreSQL — só existe no DOM quando motorBanco === 'sqlite'.
  const urlMigracaoInput = container.querySelector('#f-migracao-url');
  if (urlMigracaoInput) {
    const statusMigracao = container.querySelector('#migracao-status');
    const relatorioMigracao = container.querySelector('#migracao-relatorio');
    const btnTestar = container.querySelector('#btn-migracao-testar');
    const btnCopiar = container.querySelector('#btn-migracao-copiar');
    const btnFinalizar = container.querySelector('#btn-migracao-finalizar');

    function pegarUrlOuAvisar() {
      const url = urlMigracaoInput.value.trim();
      if (!url) mostrarToast('Informe a URL de conexão do PostgreSQL de destino.', 'erro');
      return url || null;
    }

    // Qualquer mudança na URL invalida uma cópia anterior — evita finalizar com base num
    // relatório que não corresponde mais ao destino digitado no campo.
    urlMigracaoInput.addEventListener('input', () => { btnFinalizar.disabled = true; });

    btnTestar.addEventListener('click', async () => {
      const url = pegarUrlOuAvisar();
      if (!url) return;
      statusMigracao.textContent = 'Testando conexão...';
      try {
        await api.post('/api/migracao/testar', { connectionString: url });
        statusMigracao.textContent = '✓ Conexão bem-sucedida.';
      } catch (err) {
        statusMigracao.textContent = '';
        mostrarToast(err.message, 'erro');
      }
    });

    btnCopiar.addEventListener('click', async () => {
      const url = pegarUrlOuAvisar();
      if (!url) return;
      btnFinalizar.disabled = true;
      btnCopiar.disabled = true;
      statusMigracao.textContent = 'Copiando dados — isso pode levar alguns segundos...';
      relatorioMigracao.innerHTML = '';
      try {
        const { relatorio } = await api.post('/api/migracao/copiar', { connectionString: url });
        statusMigracao.textContent = '✓ Cópia concluída. Confira o relatório antes de finalizar.';
        relatorioMigracao.innerHTML = `
          <div class="tabela-wrap" style="margin-top:10px;box-shadow:none;border:none;">
            <table>
              <thead><tr><th>Tabela</th><th>Linhas copiadas</th></tr></thead>
              <tbody>
                ${relatorio.map(r => `<tr><td>${escapeHtml(r.tabela)}</td><td>${r.destino} / ${r.origem}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        `;
        btnFinalizar.disabled = false;
      } catch (err) {
        statusMigracao.textContent = '';
        mostrarToast(err.message, 'erro');
      } finally {
        btnCopiar.disabled = false;
      }
    });

    btnFinalizar.addEventListener('click', async () => {
      const url = pegarUrlOuAvisar();
      if (!url) return;
      const ok = await confirmar(
        'Isso vai apagar todos os dados do SQLite local (com backup de segurança criado antes) e trocar o sistema para usar o PostgreSQL informado. Depois disso é preciso reiniciar o sistema. Tem certeza?',
        { titulo: 'Finalizar migração para PostgreSQL', textoConfirmar: 'Sim, finalizar', perigo: true }
      );
      if (!ok) return;

      btnFinalizar.disabled = true;
      btnCopiar.disabled = true;
      statusMigracao.textContent = 'Finalizando — apagando dados do SQLite e atualizando configuração...';
      try {
        const resultado = await api.post('/api/migracao/finalizar', { connectionString: url });
        statusMigracao.textContent = `✓ ${resultado.mensagem}`;
        mostrarToast('Migração concluída! Reinicie o sistema para usar o PostgreSQL.', 'sucesso');
      } catch (err) {
        statusMigracao.textContent = '';
        mostrarToast(err.message, 'erro');
        btnCopiar.disabled = false;
        btnFinalizar.disabled = false;
      }
    });
  }
}
