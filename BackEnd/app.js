require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use('/api/livros',      require('./routes/livros'));
app.use('/api/alunos',      require('./routes/alunos'));
app.use('/api/emprestimos', require('./routes/emprestimos'));
app.use('/api/emprestimos', require('./routes/devolucoes'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});