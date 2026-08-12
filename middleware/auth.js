const jwt = require('jsonwebtoken');
const { buscarUsuarioAutenticado, formatarUsuario } = require('../utils/usuarioAuth');

module.exports = async function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }

  try {
    const usuario = await buscarUsuarioAutenticado(payload.id);
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Sessão inválida' });
    }
    // Compara em milissegundos (payload.emitidoEm), não o `iat` padrão do JWT (só tem
    // precisão de segundo) — um `iat` truncado podia empatar com `tokens_validos_apos`
    // quando login/criação e a revogação aconteciam no mesmo segundo, rejeitando sessões
    // válidas ou deixando passar tokens revogados dependendo do operador de comparação.
    if (payload.emitidoEm < new Date(usuario.tokens_validos_apos).getTime()) {
      return res.status(401).json({ erro: 'Sessão expirada, faça login novamente' });
    }

    req.usuario = formatarUsuario(usuario);
    next();
  } catch (err) {
    next(err);
  }
};
