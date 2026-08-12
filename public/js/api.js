const TOKEN_KEY = 'biblioteca_token';
const USUARIO_KEY = 'biblioteca_usuario';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsuario() {
  const raw = localStorage.getItem(USUARIO_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function salvarSessao(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

export function limparSessao() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USUARIO_KEY);
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function requisitar(metodo, caminho, corpo) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(caminho, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  const isJson = resp.headers.get('content-type')?.includes('application/json');
  const dados = isJson ? await resp.json() : null;

  // 401 com token presente = sessão expirou/invalidou (diferente de uma tentativa de login que falhou)
  if (resp.status === 401 && token) {
    limparSessao();
    window.dispatchEvent(new CustomEvent('sessao-expirada'));
  }

  if (!resp.ok) {
    throw new ApiError(resp.status, dados?.erro || 'Erro inesperado');
  }
  return dados;
}

export const api = {
  get: (caminho) => requisitar('GET', caminho),
  post: (caminho, corpo) => requisitar('POST', caminho, corpo),
  put: (caminho, corpo) => requisitar('PUT', caminho, corpo),
  patch: (caminho, corpo) => requisitar('PATCH', caminho, corpo),
  delete: (caminho) => requisitar('DELETE', caminho),
};
