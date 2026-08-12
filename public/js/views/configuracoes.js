import { api, getUsuario } from '../api.js';
import { mostrarToast, escapeHtml } from '../utils.js';
import { aplicarIdentidadeVisual, atualizarCacheIdentidadeVisual } from '../identidadeVisual.js';

const TAMANHO_MAX_LOGO = 150 * 1024;
const MIMES_PERMITIDOS = ['image/png', 'image/jpeg', 'image/svg+xml'];

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

    <form id="form-configuracoes">
      <div class="painel">
        <h2>Geral</h2>
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

      <div class="painel">
        <h2>Identidade visual</h2>
        <div class="form-linha">
          <div class="campo">
            <label for="f-cor">Cor principal</label>
            <input type="color" id="f-cor" value="${config.cor_primaria}" ${desabilitado} style="height:42px;padding:4px;">
          </div>
          <div class="campo">
            <label for="f-logo">Logo (PNG, JPEG ou SVG, até 150KB)</label>
            <input type="file" id="f-logo" accept="image/png,image/jpeg,image/svg+xml" ${desabilitado}>
          </div>
          <div class="campo">
            <label>Prévia</label>
            <div id="logo-preview">${config.logo_data_url ? `<img src="${config.logo_data_url}" alt="Logo atual" style="max-height:48px;">` : '<span class="sub">Sem logo</span>'}</div>
          </div>
        </div>
        ${podeEditar ? '<button type="button" id="btn-remover-logo" class="btn btn-secondary btn-sm">Remover logo</button>' : ''}
      </div>

      <div class="painel">
        <h2>Segurança</h2>
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

      <p id="config-erro" class="mensagem-erro hidden"></p>
      ${podeEditar ? '<button type="submit" class="btn btn-primary">Salvar configurações</button>' : ''}
    </form>
  `;

  if (!podeEditar) return;

  let logoAtual = config.logo_data_url;

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
    container.querySelector('#logo-preview').innerHTML = `<img src="${logoAtual}" alt="Prévia" style="max-height:48px;">`;
  });

  const btnRemoverLogo = container.querySelector('#btn-remover-logo');
  if (btnRemoverLogo) {
    btnRemoverLogo.addEventListener('click', () => {
      logoAtual = null;
      container.querySelector('#logo-preview').innerHTML = '<span class="sub">Sem logo</span>';
      container.querySelector('#f-logo').value = '';
    });
  }

  container.querySelector('#f-cor').addEventListener('input', (e) => {
    aplicarIdentidadeVisual({ cor_primaria: e.target.value });
  });

  container.querySelector('#form-configuracoes').addEventListener('submit', async (e) => {
    e.preventDefault();
    const erroEl = container.querySelector('#config-erro');
    erroEl.classList.add('hidden');

    const dados = {
      nome_biblioteca: container.querySelector('#f-nome').value.trim(),
      cor_primaria: container.querySelector('#f-cor').value,
      logo_data_url: logoAtual,
      dias_emprestimo_padrao: Number(container.querySelector('#f-dias').value),
      limite_livros_por_aluno: container.querySelector('#f-limite').value
        ? Number(container.querySelector('#f-limite').value) : null,
      login_max_tentativas: Number(container.querySelector('#f-max-tentativas').value),
      login_bloqueio_minutos: Number(container.querySelector('#f-bloqueio').value),
      auditoria_retencao_dias: Number(container.querySelector('#f-retencao').value),
    };

    try {
      const atualizado = await api.put('/api/configuracoes', dados);
      mostrarToast('Configurações salvas.', 'sucesso');
      aplicarIdentidadeVisual(atualizado);
      atualizarCacheIdentidadeVisual(atualizado);
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.classList.remove('hidden');
    }
  });
}
