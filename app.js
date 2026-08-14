require('dotenv').config();
const express = require('express');
const app = express();

const autenticar = require('./middleware/auth');
const { autorizar } = require('./middleware/permissao');
const somenteLocal = require('./middleware/somenteLocal');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// limite maior que o padrão (100kb) para acomodar o logo em base64 (~150KB) no payload de configurações
app.use(express.json({ limit: '1mb' }));
app.use(somenteLocal);
app.use(express.static('public'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/identidade-visual', require('./routes/identidadeVisual'));

app.use('/api/livros',      autenticar, require('./routes/livros'));
app.use('/api/generos',     autenticar, require('./routes/generos'));
app.use('/api/tipos',       autenticar, require('./routes/tipos'));
app.use('/api/alunos',      autenticar, require('./routes/alunos'));
app.use('/api/turmas',      autenticar, require('./routes/turmas'));
app.use('/api/emprestimos', autenticar, require('./routes/emprestimos'));
app.use('/api/emprestimos', autenticar, require('./routes/devolucoes'));
app.use('/api/dashboard',   autenticar, require('./routes/dashboard'));
app.use('/api/estatisticas', autenticar, require('./routes/estatisticas'));

app.use('/api/permissoes',    autenticar, require('./routes/permissoes'));
app.use('/api/papeis',        autenticar, autorizar('papeis.gerenciar'),   require('./routes/papeis'));
app.use('/api/usuarios',      autenticar, autorizar('usuarios.gerenciar'), require('./routes/usuarios'));
app.use('/api/auditoria',     autenticar, autorizar('auditoria.ver'),      require('./routes/auditoria'));
app.use('/api/configuracoes', autenticar, require('./routes/configuracoes'));
app.use('/api/migracao',      autenticar, require('./routes/migracao'));
// Sem "autenticar" no mount — a rota /status precisa responder mesmo sem sessão (ver
// routes/atualizacao.js, que autentica as outras individualmente).
app.use('/api/atualizacao', require('./routes/atualizacao'));

app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3303;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

// Mantém a versão exibida no menu sempre igual à do código rodando de fato — atualiza a
// cada início do servidor (dev ou o serviço instalado), não só durante a instalação.
require('./config/db')
  .query('UPDATE configuracoes SET versao_sistema = $1 WHERE id = 1', [require('./package.json').version])
  .catch(err => console.error('⚠️  Não consegui atualizar a versão do sistema:', err.message));

// Chegar até aqui rodando o código novo já é a prova de que uma auto-atualização em
// andamento (se havia uma) deu certo — o processo anterior nem chega a rodar essa linha
// (o instalador para o serviço antes de copiar os arquivos), então essa limpeza só
// acontece no processo novo, depois do reinício.
require('./utils/atualizador').limparEstadoNaSubida();
