const CACHE_KEY = 'biblioteca_identidade_visual';

// Cor padrão de fábrica (mesma do :root em style.css). Quando a cor configurada é
// exatamente essa, não mexemos nas CSS custom properties — os valores hardcoded do
// CSS continuam valendo tal como são, sem depender da fórmula de derivação em JS
// reproduzir os tons originais com precisão de pixel (ela é só uma aproximação boa
// o bastante para cores escolhidas pelo usuário, não para preservar o padrão exato).
const COR_PADRAO = '#4f46e5';

function hexParaRgb(hex) {
  const limpo = hex.replace('#', '');
  return {
    r: parseInt(limpo.slice(0, 2), 16),
    g: parseInt(limpo.slice(2, 4), 16),
    b: parseInt(limpo.slice(4, 6), 16),
  };
}

function rgbParaHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslParaHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else               [r, g, b] = [c, 0, x];
  const paraHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${paraHex(r)}${paraHex(g)}${paraHex(b)}`;
}

// Deriva os tons de hover/soft/light a partir da cor primária escolhida — mantém a UI de
// configuração simples (uma cor só) sem perder a linguagem visual (hover mais escuro, etc).
function derivarTons(corPrimaria) {
  const { h, s, l } = rgbParaHsl(hexParaRgb(corPrimaria));
  return {
    hover: hslParaHex(h, s, Math.max(0, l - 8)),
    soft: hslParaHex(h, Math.min(100, s * 0.5), 95),
    light: hslParaHex(h, s, Math.min(100, l + 18)),
  };
}

export function aplicarIdentidadeVisual(config) {
  if (!config) return;
  const root = document.documentElement.style;

  if (config.cor_primaria && config.cor_primaria.toLowerCase() !== COR_PADRAO) {
    const { hover, soft, light } = derivarTons(config.cor_primaria);
    root.setProperty('--color-primary', config.cor_primaria);
    root.setProperty('--color-primary-hover', hover);
    root.setProperty('--color-primary-soft', soft);
    root.setProperty('--color-primary-light', light);
  } else if (config.cor_primaria) {
    // Volta explicitamente ao padrão do CSS (útil se uma cor customizada foi aplicada
    // nesta mesma sessão — ex: prévia ao vivo na tela de Configurações — e o valor
    // mudou de volta para o padrão antes de salvar).
    ['--color-primary', '--color-primary-hover', '--color-primary-soft', '--color-primary-light']
      .forEach(v => root.removeProperty(v));
  }

  if (config.nome_biblioteca) {
    document.title = config.nome_biblioteca;
    document.querySelectorAll('[data-nome-biblioteca]').forEach(el => { el.textContent = config.nome_biblioteca; });
  }

  if (config.logo_data_url) {
    document.querySelectorAll('[data-logo-biblioteca]').forEach(el => {
      el.innerHTML = `<img src="${config.logo_data_url}" alt="Logo" style="height:1em;vertical-align:-0.15em;">`;
    });
  }
}

// Usado pela tela de Configurações após salvar, pra manter o cache em sincronia sem duplicar a chave.
export function atualizarCacheIdentidadeVisual(config) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    nome_biblioteca: config.nome_biblioteca,
    cor_primaria: config.cor_primaria,
    logo_data_url: config.logo_data_url,
  }));
}

export async function carregarIdentidadeVisual() {
  const cache = localStorage.getItem(CACHE_KEY);
  if (cache) {
    try { aplicarIdentidadeVisual(JSON.parse(cache)); } catch (err) { /* cache inválido, ignora */ }
  }

  try {
    const resp = await fetch('/api/identidade-visual');
    if (!resp.ok) return;
    const config = await resp.json();
    aplicarIdentidadeVisual(config);
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch (err) {
    // offline/erro de rede: mantém o que já foi aplicado do cache (ou o padrão do CSS)
  }
}
