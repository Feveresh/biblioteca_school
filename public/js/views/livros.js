import { api } from '../api.js';
import { escapeHtml, mostrarToast, abrirModal, fecharModal, confirmar, debounce, imprimirTabela } from '../utils.js';

const TAMANHO_MAX_CAPA = 220 * 1024;
const MIMES_CAPA_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp'];

function lerArquivoComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

// Preto ou branco, o que der mais contraste contra a cor de fundo (fórmula de luminância
// relativa do WCAG) — usado no texto do badge de gênero, que pode ter qualquer cor escolhida.
function corTextoContraste(hexFundo) {
  const r = parseInt(hexFundo.slice(1, 3), 16);
  const g = parseInt(hexFundo.slice(3, 5), 16);
  const b = parseInt(hexFundo.slice(5, 7), 16);
  const canal = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const luminancia = 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  return luminancia > 0.45 ? '#1e2130' : '#ffffff';
}

const COLUNAS_IMPRESSAO = [
  { rotulo: 'Tombo', valor: l => l.tombo },
  { rotulo: 'Título', valor: l => l.titulo },
  { rotulo: 'Autor', valor: l => l.autor || '' },
  { rotulo: 'Tipo', valor: l => l.tipo_nome || '' },
  { rotulo: 'Gênero', valor: l => l.genero_nome || '' },
  { rotulo: 'Páginas', valor: l => l.paginas ?? '' },
  { rotulo: 'Localização', valor: l => [l.estante, l.prateleira].filter(Boolean).join(' / ') },
  { rotulo: 'Status', valor: l => l.disponivel ? 'Disponível' : 'Indisponível' },
];

const NOVO_GENERO = '__novo__';
const NOVO_TIPO = '__novo__';
const TIPO_PADRAO = 'Livro';

const ABAS = [
  { id: 'itens', rotulo: 'Itens' },
  { id: 'cadastro', rotulo: 'Cadastro' },
];

export default async function renderLivros(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Biblioteca</h1>
        <div class="sub">Acervo da biblioteca</div>
      </div>
    </div>

    <div class="abas">
      ${ABAS.map((a, i) => `<button type="button" class="aba-btn ${i === 0 ? 'ativa' : ''}" data-aba="${a.id}">${a.rotulo}</button>`).join('')}
    </div>

    <div class="aba-conteudo" data-aba-conteudo="itens">
      <div class="toolbar">
        <input type="search" id="busca-livro" placeholder="Buscar por título, autor ou tombo…">
        <select id="filtro-disponivel">
          <option value="">Disponibilidade (todas)</option>
          <option value="true">Disponíveis</option>
          <option value="false">Indisponíveis</option>
        </select>
        <select id="filtro-tipo"><option value="">Tipo (todos)</option></select>
        <select id="filtro-genero"><option value="">Gênero (todos)</option></select>
        <select id="filtro-estante"><option value="">Localização (todas)</option></select>
        <button id="btn-imprimir" class="btn btn-secondary btn-sm">🖨️ Imprimir</button>
      </div>
      <div class="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Capa</th>
              <th data-ordenar="tombo" style="cursor:pointer;user-select:none;">Tombo <span class="seta-ordenacao" data-seta="tombo"></span></th>
              <th data-ordenar="titulo" style="cursor:pointer;user-select:none;">Título <span class="seta-ordenacao" data-seta="titulo"></span></th>
              <th data-ordenar="autor" style="cursor:pointer;user-select:none;">Autor <span class="seta-ordenacao" data-seta="autor"></span></th>
              <th>Tipo</th>
              <th data-ordenar="genero" style="cursor:pointer;user-select:none;">Gênero <span class="seta-ordenacao" data-seta="genero"></span></th>
              <th>Páginas</th><th>Localização</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody id="tbody-livros"></tbody>
        </table>
      </div>
      <div class="toolbar" id="paginacao" style="justify-content:flex-end;margin-top:14px;"></div>
    </div>

    <div class="aba-conteudo hidden" data-aba-conteudo="cadastro">
      <div class="painel">
        <h2>Cadastrar novo item</h2>
        <p class="sub" style="margin:-8px 0 16px;">Livros, HQs, mangás, revistas — qualquer item do acervo. Novos gêneros e tipos podem ser criados direto no formulário.</p>
        <button id="btn-novo-item" class="btn btn-primary">+ Novo item</button>
      </div>
      <div class="painel">
        <h2>Gêneros</h2>
        <p class="sub" style="margin:-8px 0 16px;">A cor escolhida aparece como fundo do gênero na lista de itens.</p>
        <div id="lista-generos-cadastro"></div>
      </div>
      <div class="painel">
        <h2>Tipos</h2>
        <div id="lista-tipos-cadastro"></div>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#tbody-livros');
  const inputBusca = container.querySelector('#busca-livro');
  const filtroDisponivel = container.querySelector('#filtro-disponivel');
  const filtroTipo = container.querySelector('#filtro-tipo');
  const filtroGenero = container.querySelector('#filtro-genero');
  const filtroEstante = container.querySelector('#filtro-estante');
  const paginacaoEl = container.querySelector('#paginacao');

  let pagina = 1;
  const porPagina = 20;
  let ordenarPor = 'titulo';
  let ordem = 'asc';
  let generos = [];
  let tipos = [];

  function atualizarSetas() {
    container.querySelectorAll('.seta-ordenacao').forEach(el => {
      el.textContent = el.dataset.seta === ordenarPor ? (ordem === 'asc' ? '▲' : '▼') : '';
    });
  }

  function localizacao(livro) {
    if (!livro.estante && !livro.prateleira) return '—';
    return [livro.estante, livro.prateleira].filter(Boolean).join(' / ');
  }

  // Texto puro quando o gênero não tem cor (comportamento de sempre) — badge colorido só
  // depois que uma cor é escolhida na aba Cadastro.
  function celulaGenero(livro) {
    if (!livro.genero_nome) return '—';
    const genero = generos.find(g => g.id === livro.genero_id);
    if (!genero?.cor) return escapeHtml(livro.genero_nome);
    return `<span class="badge" style="background:${genero.cor};color:${corTextoContraste(genero.cor)};">${escapeHtml(livro.genero_nome)}</span>`;
  }

  async function carregarGeneros() {
    generos = await api.get('/api/generos');
    filtroGenero.innerHTML = '<option value="">Gênero (todos)</option>'
      + generos.map(g => `<option value="${g.id}">${escapeHtml(g.nome)}</option>`).join('');
    renderListaGeneros();
  }

  async function carregarTipos() {
    tipos = await api.get('/api/tipos');
    filtroTipo.innerHTML = '<option value="">Tipo (todos)</option>'
      + tipos.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('');
    renderListaTipos();
  }

  function renderListaGeneros() {
    const el = container.querySelector('#lista-generos-cadastro');
    if (!el) return;
    if (!generos.length) {
      el.innerHTML = '<p class="sub">Nenhum gênero cadastrado ainda.</p>';
      return;
    }
    el.innerHTML = generos.map(g => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-border);">
        <input type="color" data-cor-genero="${g.id}" value="${g.cor || '#94a3b8'}" title="Escolher cor" style="width:36px;height:28px;padding:0;border:1px solid var(--color-border);border-radius:6px;cursor:pointer;background:none;flex-shrink:0;">
        <span class="badge" style="${g.cor ? `background:${g.cor};color:${corTextoContraste(g.cor)};` : 'background:var(--color-border);color:var(--color-text-muted);'}">${escapeHtml(g.nome)}</span>
        ${g.cor ? `<button type="button" class="btn btn-secondary btn-sm" data-limpar-cor-genero="${g.id}">Sem cor</button>` : ''}
      </div>
    `).join('');
  }

  function renderListaTipos() {
    const el = container.querySelector('#lista-tipos-cadastro');
    if (!el) return;
    if (!tipos.length) {
      el.innerHTML = '<p class="sub">Nenhum tipo cadastrado ainda.</p>';
      return;
    }
    el.innerHTML = tipos.map(t => `
      <div style="padding:8px 0;border-bottom:1px solid var(--color-border);">${escapeHtml(t.nome)}</div>
    `).join('');
  }

  async function alterarCorGenero(id, cor) {
    try {
      const atualizado = await api.patch(`/api/generos/${id}`, { cor });
      const idx = generos.findIndex(g => g.id === Number(id));
      if (idx !== -1) generos[idx] = atualizado;
      renderListaGeneros();
      carregar();
    } catch (err) {
      mostrarToast(err.message, 'erro');
    }
  }

  async function carregarEstantes() {
    const estantes = await api.get('/api/livros/estantes');
    filtroEstante.innerHTML = '<option value="">Localização (todas)</option>'
      + estantes.map(e => `<option value="${escapeHtml(e)}">Estante ${escapeHtml(e)}</option>`).join('');
  }

  function construirParams() {
    const params = new URLSearchParams({ ordenarPor, ordem });
    const busca = inputBusca.value.trim();
    if (busca) params.set('busca', busca);
    if (filtroDisponivel.value) params.set('disponivel', filtroDisponivel.value);
    if (filtroTipo.value) params.set('tipo_id', filtroTipo.value);
    if (filtroGenero.value) params.set('genero_id', filtroGenero.value);
    if (filtroEstante.value) params.set('estante', filtroEstante.value);
    return params;
  }

  async function carregar() {
    tbody.innerHTML = `<tr><td colspan="10" class="celula-vazia">Carregando…</td></tr>`;
    const params = construirParams();
    params.set('pagina', pagina);
    params.set('porPagina', porPagina);

    const { dados: livros, total } = await api.get(`/api/livros?${params.toString()}`);

    if (!livros.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="celula-vazia">Nenhum item encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = livros.map(l => `
        <tr>
          <td>${l.capa_data_url
            ? `<img src="${l.capa_data_url}" alt="Capa de ${escapeHtml(l.titulo)}" style="width:32px;height:44px;object-fit:cover;border-radius:3px;">`
            : `<span class="sub" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:44px;">—</span>`}
          </td>
          <td>${escapeHtml(l.tombo)}</td>
          <td>${escapeHtml(l.titulo)}</td>
          <td>${escapeHtml(l.autor || '—')}</td>
          <td>${escapeHtml(l.tipo_nome || '—')}</td>
          <td>${celulaGenero(l)}</td>
          <td>${l.paginas ?? '—'}</td>
          <td>${escapeHtml(localizacao(l))}</td>
          <td>
            <button type="button" class="badge badge-clicavel ${l.disponivel ? 'badge-sucesso' : 'badge-perigo'}" data-alternar-disponibilidade="${l.id}" title="Clique para alternar manualmente">
              ${l.disponivel ? 'Disponível' : 'Indisponível'}
            </button>
          </td>
          <td class="tabela-acoes">
            <button class="btn btn-secondary btn-sm" data-editar="${l.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-excluir="${l.id}">Excluir</button>
          </td>
        </tr>
      `).join('');
    }

    atualizarSetas();

    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    paginacaoEl.innerHTML = `
      <button id="btn-anterior" class="btn btn-secondary btn-sm" ${pagina <= 1 ? 'disabled' : ''}>← Anterior</button>
      <span class="sub">Página ${pagina} de ${totalPaginas} (${total} item(ns))</span>
      <button id="btn-proxima" class="btn btn-secondary btn-sm" ${pagina >= totalPaginas ? 'disabled' : ''}>Próxima →</button>
    `;
    paginacaoEl.querySelector('#btn-anterior').addEventListener('click', () => { pagina--; carregar(); });
    paginacaoEl.querySelector('#btn-proxima').addEventListener('click', () => { pagina++; carregar(); });
  }

  function opcoesGenero(selecionado) {
    return generos.map(g => `<option value="${g.id}" ${g.id === selecionado ? 'selected' : ''}>${escapeHtml(g.nome)}</option>`).join('');
  }

  // Item novo já vem com o tipo "Livro" pré-selecionado (o mais comum) — editando, respeita
  // o tipo já salvo. Se "Livro" não existir mais no catálogo (renomeado/excluído), não força nada.
  function opcoesTipo(selecionado, ehNovo) {
    const padraoId = ehNovo ? tipos.find(t => t.nome === TIPO_PADRAO)?.id : null;
    const idParaMarcar = selecionado ?? padraoId;
    return tipos.map(t => `<option value="${t.id}" ${t.id === idParaMarcar ? 'selected' : ''}>${escapeHtml(t.nome)}</option>`).join('');
  }

  function abrirFormulario(livro) {
    const editando = Boolean(livro);
    const corpo = abrirModal(editando ? 'Editar item' : 'Novo item', `
      <form id="form-livro">
        <div class="campo-capa-livro">
          <div id="capa-preview" class="capa-preview-grande">${livro && livro.capa_data_url ? `<img src="${livro.capa_data_url}" alt="Prévia da capa">` : '<span class="sub">Sem capa</span>'}</div>
          <div class="campo">
            <label for="f-capa">Capa <span class="sub">(opcional, PNG/JPEG/WEBP até 220KB)</span></label>
            <input type="file" id="f-capa" accept="image/png,image/jpeg,image/webp">
            ${livro && livro.capa_data_url ? '<button type="button" id="btn-remover-capa" class="btn btn-secondary btn-sm" style="margin-top:8px;">Remover capa</button>' : ''}
          </div>
        </div>
        <div class="modal-grade">
          <div class="campo">
            <label for="f-tombo">Tombo</label>
            <input id="f-tombo" required value="${livro ? escapeHtml(livro.tombo) : ''}">
          </div>
          <div class="campo">
            <label for="f-titulo">Título</label>
            <input id="f-titulo" required value="${livro ? escapeHtml(livro.titulo) : ''}">
          </div>
          <div class="campo">
            <label for="f-autor">Autor</label>
            <input id="f-autor" value="${livro && livro.autor ? escapeHtml(livro.autor) : ''}">
          </div>
          <div class="campo">
            <label for="f-editora">Editora <span class="sub">(opcional)</span></label>
            <input id="f-editora" value="${livro && livro.editora ? escapeHtml(livro.editora) : ''}">
          </div>
          <div class="campo">
            <label for="f-ano">Ano de publicação <span class="sub">(opcional)</span></label>
            <input type="number" id="f-ano" min="1400" max="2100" value="${livro && livro.ano_publicacao ? livro.ano_publicacao : ''}">
          </div>
          <div class="campo">
            <label for="f-paginas">Páginas <span class="sub">(opcional)</span></label>
            <input type="number" id="f-paginas" min="1" value="${livro && livro.paginas ? livro.paginas : ''}">
          </div>
          <div class="campo">
            <label>Localização</label>
            <div class="grupo-colado">
              <input id="f-estante" placeholder="Estante" value="${livro && livro.estante ? escapeHtml(livro.estante) : ''}">
              <input id="f-prateleira" placeholder="Prateleira" value="${livro && livro.prateleira ? escapeHtml(livro.prateleira) : ''}">
            </div>
          </div>
          <div class="campo">
            <label for="f-tipo">Tipo</label>
            <select id="f-tipo">
              ${opcoesTipo(livro ? livro.tipo_id : null, !editando)}
              <option value="${NOVO_TIPO}">+ Adicionar novo tipo…</option>
            </select>
            <input type="text" id="f-tipo-novo" placeholder="Nome do novo tipo" class="hidden" style="margin-top:8px;">
          </div>
          <div class="campo">
            <label for="f-genero">Gênero</label>
            <select id="f-genero">
              <option value="">Sem gênero</option>
              ${opcoesGenero(livro ? livro.genero_id : null)}
              <option value="${NOVO_GENERO}">+ Adicionar novo gênero…</option>
            </select>
            <input type="text" id="f-genero-novo" placeholder="Nome do novo gênero" class="hidden" style="margin-top:8px;">
          </div>
        </div>
        <p id="form-livro-erro" class="mensagem-erro hidden"></p>
        <div class="modal-acoes">
          <button type="button" class="btn btn-secondary" id="cancelar-livro">Cancelar</button>
          <button type="submit" class="btn btn-primary">${editando ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    `, { grande: true });

    const selectGenero = corpo.querySelector('#f-genero');
    const inputGeneroNovo = corpo.querySelector('#f-genero-novo');
    selectGenero.addEventListener('change', () => {
      const ehNovo = selectGenero.value === NOVO_GENERO;
      inputGeneroNovo.classList.toggle('hidden', !ehNovo);
      if (ehNovo) inputGeneroNovo.focus();
    });

    const selectTipo = corpo.querySelector('#f-tipo');
    const inputTipoNovo = corpo.querySelector('#f-tipo-novo');
    selectTipo.addEventListener('change', () => {
      const ehNovo = selectTipo.value === NOVO_TIPO;
      inputTipoNovo.classList.toggle('hidden', !ehNovo);
      if (ehNovo) inputTipoNovo.focus();
    });

    let capaAtual = livro?.capa_data_url || null;
    corpo.querySelector('#f-capa').addEventListener('change', async (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      if (!MIMES_CAPA_PERMITIDOS.includes(arquivo.type)) {
        mostrarToast('Formato de imagem não suportado. Use PNG, JPEG ou WEBP.', 'erro');
        e.target.value = '';
        return;
      }
      if (arquivo.size > TAMANHO_MAX_CAPA) {
        mostrarToast('Capa muito grande — o máximo é 220KB.', 'erro');
        e.target.value = '';
        return;
      }
      capaAtual = await lerArquivoComoDataUrl(arquivo);
      corpo.querySelector('#capa-preview').innerHTML = `<img src="${capaAtual}" alt="Prévia da capa">`;
    });

    const btnRemoverCapa = corpo.querySelector('#btn-remover-capa');
    if (btnRemoverCapa) {
      btnRemoverCapa.addEventListener('click', () => {
        capaAtual = null;
        corpo.querySelector('#capa-preview').innerHTML = '<span class="sub">Sem capa</span>';
        corpo.querySelector('#f-capa').value = '';
      });
    }

    corpo.querySelector('#cancelar-livro').addEventListener('click', fecharModal);
    corpo.querySelector('#form-livro').addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = corpo.querySelector('#form-livro-erro');
      erroEl.classList.add('hidden');

      let generoId = selectGenero.value || null;
      let tipoId = selectTipo.value || null;
      try {
        if (generoId === NOVO_GENERO) {
          const nomeNovo = inputGeneroNovo.value.trim();
          if (!nomeNovo) {
            erroEl.textContent = 'Digite o nome do novo gênero.';
            erroEl.classList.remove('hidden');
            return;
          }
          const novoGenero = await api.post('/api/generos', { nome: nomeNovo });
          generos.push(novoGenero);
          renderListaGeneros();
          generoId = novoGenero.id;
        }

        if (tipoId === NOVO_TIPO) {
          const nomeNovo = inputTipoNovo.value.trim();
          if (!nomeNovo) {
            erroEl.textContent = 'Digite o nome do novo tipo.';
            erroEl.classList.remove('hidden');
            return;
          }
          const novoTipo = await api.post('/api/tipos', { nome: nomeNovo });
          tipos.push(novoTipo);
          renderListaTipos();
          tipoId = novoTipo.id;
        }

        const dados = {
          tombo: corpo.querySelector('#f-tombo').value.trim(),
          titulo: corpo.querySelector('#f-titulo').value.trim(),
          autor: corpo.querySelector('#f-autor').value.trim() || null,
          editora: corpo.querySelector('#f-editora').value.trim() || null,
          ano_publicacao: corpo.querySelector('#f-ano').value ? Number(corpo.querySelector('#f-ano').value) : null,
          paginas: corpo.querySelector('#f-paginas').value ? Number(corpo.querySelector('#f-paginas').value) : null,
          estante: corpo.querySelector('#f-estante').value.trim() || null,
          prateleira: corpo.querySelector('#f-prateleira').value.trim() || null,
          genero_id: generoId,
          tipo_id: tipoId,
          capa_data_url: capaAtual,
        };
        if (editando) {
          await api.put(`/api/livros/${livro.id}`, dados);
          mostrarToast('Item atualizado.', 'sucesso');
        } else {
          await api.post('/api/livros', dados);
          mostrarToast('Item cadastrado.', 'sucesso');
        }
        fecharModal();
        await Promise.all([carregarGeneros(), carregarTipos(), carregarEstantes()]);
        carregar();
      } catch (err) {
        erroEl.textContent = err.message;
        erroEl.classList.remove('hidden');
      }
    });
  }

  container.querySelector('#btn-imprimir').addEventListener('click', async () => {
    const params = construirParams();
    params.set('pagina', 1);
    params.set('porPagina', 500);
    const { dados } = await api.get(`/api/livros?${params.toString()}`);
    imprimirTabela('Biblioteca', COLUNAS_IMPRESSAO, dados);
  });

  container.querySelectorAll('.aba-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.aba-btn').forEach(b => b.classList.toggle('ativa', b === btn));
      container.querySelectorAll('[data-aba-conteudo]').forEach(secao => {
        secao.classList.toggle('hidden', secao.dataset.abaConteudo !== btn.dataset.aba);
      });
    });
  });

  container.querySelector('#btn-novo-item').addEventListener('click', () => abrirFormulario(null));

  // Delegação de evento: a lista de gêneros é redesenhada a cada mudança de cor, então os
  // listeners vão no container fixo (#lista-generos-cadastro), não nos inputs/botões em si.
  container.querySelector('#lista-generos-cadastro').addEventListener('change', (e) => {
    const id = e.target.dataset.corGenero;
    if (id) alterarCorGenero(id, e.target.value);
  });
  container.querySelector('#lista-generos-cadastro').addEventListener('click', (e) => {
    const id = e.target.dataset.limparCorGenero;
    if (id) alterarCorGenero(id, null);
  });

  inputBusca.addEventListener('input', debounce(() => { pagina = 1; carregar(); }, 350));
  filtroDisponivel.addEventListener('change', () => { pagina = 1; carregar(); });
  filtroTipo.addEventListener('change', () => { pagina = 1; carregar(); });
  filtroGenero.addEventListener('change', () => { pagina = 1; carregar(); });
  filtroEstante.addEventListener('change', () => { pagina = 1; carregar(); });

  container.querySelectorAll('[data-ordenar]').forEach(th => {
    th.addEventListener('click', () => {
      const coluna = th.dataset.ordenar;
      if (ordenarPor === coluna) {
        ordem = ordem === 'asc' ? 'desc' : 'asc';
      } else {
        ordenarPor = coluna;
        ordem = 'asc';
      }
      pagina = 1;
      carregar();
    });
  });

  tbody.addEventListener('click', async (e) => {
    const idEditar = e.target.dataset.editar;
    const idExcluir = e.target.dataset.excluir;
    const idAlternar = e.target.dataset.alternarDisponibilidade;

    if (idAlternar) {
      try {
        await api.patch(`/api/livros/${idAlternar}/disponibilidade`);
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
      return;
    }
    if (idEditar) {
      const livro = await api.get(`/api/livros/${idEditar}`);
      abrirFormulario(livro);
    }
    if (idExcluir) {
      const ok = await confirmar('Tem certeza que deseja excluir este item? Essa ação não pode ser desfeita.', {
        titulo: 'Excluir item', textoConfirmar: 'Excluir', perigo: true,
      });
      if (!ok) return;
      try {
        await api.delete(`/api/livros/${idExcluir}`);
        mostrarToast('Item removido.', 'sucesso');
        carregar();
      } catch (err) {
        mostrarToast(err.message, 'erro');
      }
    }
  });

  await Promise.all([carregarGeneros(), carregarTipos(), carregarEstantes()]);
  await carregar();
}
