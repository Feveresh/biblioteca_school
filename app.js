require('dotenv').config();
const express = require('express');
const app = express();

const autenticar = require('./middleware/auth');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', require('./routes/auth'));

app.use('/api/livros',      autenticar, require('./routes/livros'));
app.use('/api/alunos',      autenticar, require('./routes/alunos'));
app.use('/api/emprestimos', autenticar, require('./routes/emprestimos'));
app.use('/api/emprestimos', autenticar, require('./routes/devolucoes'));
app.use('/api/dashboard',   autenticar, require('./routes/dashboard'));

app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
