module.exports = function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23505') return res.status(409).json({ erro: 'Registro duplicado' });
  if (err.code === '23503') return res.status(409).json({ erro: 'Referência inválida' });
  if (err.code === '22P02') return res.status(400).json({ erro: 'Valor inválido informado' });

  res.status(500).json({ erro: 'Erro interno do servidor' });
};
