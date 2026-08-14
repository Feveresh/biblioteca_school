const { lerEstado, verificarAtualizacao, iniciarAtualizacao, cancelarEstadoDeErro } = require('../utils/atualizador');

// GET /api/atualizacao/status — público (sem autenticação): qualquer aba, mesmo antes de
// logar, precisa saber se o sistema está no meio de uma atualização pra mostrar a tela fixa
// em vez do login/app normal.
exports.status = async (req, res) => {
  res.json(lerEstado());
};

// GET /api/atualizacao/verificar — chamado no login.
exports.verificar = async (req, res) => {
  res.json(await verificarAtualizacao());
};

// POST /api/atualizacao/iniciar — dispara o download + instalação silenciosa.
exports.iniciar = async (req, res) => {
  try {
    const resultado = await iniciarAtualizacao();
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
};

// POST /api/atualizacao/limpar-erro — permite sair de um estado travado em "erro" (ex:
// download falhou) sem precisar mexer manualmente no arquivo de estado no servidor.
exports.limparErro = async (req, res) => {
  cancelarEstadoDeErro();
  res.json({ ok: true });
};
