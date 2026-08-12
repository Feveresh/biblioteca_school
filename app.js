require('dotenv').config();
const express = require('express');
const app = express();

const autenticar = require('./middleware/auth');
const { autorizar } = require('./middleware/permissao');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// limite maior que o padrão (100kb) para acomodar o logo em base64 (~150KB) no payload de configurações
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/identidade-visual', require('./routes/identidadeVisual'));

app.use('/api/livros',      autenticar, require('./routes/livros'));
app.use('/api/alunos',      autenticar, require('./routes/alunos'));
app.use('/api/emprestimos', autenticar, require('./routes/emprestimos'));
app.use('/api/emprestimos', autenticar, require('./routes/devolucoes'));
app.use('/api/dashboard',   autenticar, require('./routes/dashboard'));

app.use('/api/permissoes',    autenticar, require('./routes/permissoes'));
app.use('/api/papeis',        autenticar, autorizar('papeis.gerenciar'),   require('./routes/papeis'));
app.use('/api/usuarios',      autenticar, autorizar('usuarios.gerenciar'), require('./routes/usuarios'));
app.use('/api/auditoria',     autenticar, autorizar('auditoria.ver'),      require('./routes/auditoria'));
app.use('/api/configuracoes', autenticar, require('./routes/configuracoes'));

app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
