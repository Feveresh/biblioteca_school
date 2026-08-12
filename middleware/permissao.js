// Uso: autorizar('livros.criar') — precisa rodar depois de `autenticar`.
module.exports.autorizar = (...codigos) => (req, res, next) => {
  const { permissoes, papel } = req.usuario;
  if (papel.acessoTotal || codigos.some(c => permissoes.includes(c))) {
    return next();
  }
  return res.status(403).json({ erro: 'Sem permissão para esta ação' });
};
