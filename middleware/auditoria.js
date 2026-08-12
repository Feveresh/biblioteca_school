const pool = require('../config/db');
const { registrar } = require('../utils/auditoria');

const ROTULO_POR_METODO = { POST: 'criar', PUT: 'atualizar', PATCH: 'atualizar', DELETE: 'excluir' };

// Recursos de linha única (sem :id na rota, ex: PUT /api/configuracoes) — sempre id=1.
const ENTIDADES_SINGULARES = new Set(['configuracoes']);

// Nome da entidade (usado na API/telas) -> tabela real no banco, para a pré-leitura de dados_antes.
const TABELA_POR_ENTIDADE = {
  livros: 'livros',
  alunos: 'alunos',
  emprestimos: 'emprestimos',
  usuarios: 'users',
  papeis: 'roles',
  configuracoes: 'configuracoes',
};

// Uso: app.use('/api/livros', autenticar, auditoria('livros'), require('./routes/livros'))
module.exports = function auditoria(entidade) {
  const tabela = TABELA_POR_ENTIDADE[entidade];
  if (!tabela) {
    throw new Error(`Entidade de auditoria desconhecida: ${entidade}`);
  }

  return function (req, res, next) {
    const metodo = req.method;
    if (!(metodo in ROTULO_POR_METODO)) return next();

    (async () => {
      const idPreLeitura = req.params.id || (ENTIDADES_SINGULARES.has(entidade) ? 1 : null);
      let dadosAntes = null;
      if (metodo !== 'POST' && idPreLeitura) {
        try {
          const { rows } = await pool.query(`SELECT * FROM ${tabela} WHERE id = $1`, [idPreLeitura]);
          dadosAntes = rows[0] || null;
        } catch (err) {
          // best-effort: falha na pré-leitura nunca deve bloquear a requisição real
        }
      }

      // Intercepta res.json para capturar o corpo da resposta sem exigir mudanças nos controllers.
      const jsonOriginal = res.json.bind(res);
      let corpoResposta;
      res.json = (corpo) => {
        corpoResposta = corpo;
        return jsonOriginal(corpo);
      };

      res.on('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return; // só grava mudanças que de fato aconteceram

        const acao = res.locals.auditAcao || ROTULO_POR_METODO[metodo];
        const entidadeId = res.locals.auditEntidadeId
          ?? corpoResposta?.id
          ?? (req.params.id ? Number(req.params.id) : null);

        registrar({
          usuarioId: req.usuario?.id,
          entidade,
          entidadeId,
          acao,
          dadosAntes,
          dadosDepois: corpoResposta,
          ip: req.ip,
          metodoHttp: metodo,
          rota: req.originalUrl,
        }).catch(err => console.error('Falha ao registrar auditoria:', err.message));
      });

      next();
    })();
  };
};
