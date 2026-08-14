require('dotenv').config();

// Adaptador de banco: expõe a mesma interface (`query`, `connect`, `end`) rodando em cima do
// PostgreSQL (`pg`) ou do SQLite (`node:sqlite`, embutido no próprio Node — sem addon nativo
// novo, o que importa pro instalador empacotar um runtime portátil sem dor de cabeça de build
// por plataforma). Toda controller continua chamando `pool.query(sql, params)` e recebendo
// `{ rows }`/`{ rowCount }` exatamente como antes — o motor ativo é escolhido aqui, uma vez só.
//
// DATABASE_URL definida (postgresql://...) = Postgres. Ausente = SQLite (arquivo local,
// caminho em DB_SQLITE_PATH ou "biblioteca.db" na raiz do projeto por padrão).
const usaPostgres = Boolean(process.env.DATABASE_URL);

// Mapa dos "extended result codes" do SQLite pros SQLSTATE do Postgres que as controllers já
// checam (err.code === '23505' etc.) — sem isso, cada controller precisaria saber qual motor
// está rodando pra tratar erro de violação de constraint.
const MAPA_ERRO_SQLITE = {
  1299: '23502', // NOT NULL
  1555: '23505', // PRIMARY KEY
  2067: '23505', // UNIQUE
  787: '23503',  // FOREIGN KEY
  275: '23514',  // CHECK
};

function criarAdaptadorPostgres() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  pool.query('SELECT 1')
    .then(() => console.log('✅ PostgreSQL conectado'))
    .catch(err => console.error('❌ Erro na conexão:', err.message));

  return pool;
}

function criarAdaptadorSqlite() {
  const path = require('path');
  const { DatabaseSync } = require('node:sqlite');

  const caminho = process.env.DB_SQLITE_PATH || path.join(__dirname, '..', 'biblioteca.db');
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  console.log(`✅ SQLite conectado (${caminho})`);

  // true/false do JS não fazem bind direto em parâmetro do SQLite (erro em tempo de execução)
  // — SQLite não tem tipo booleano nativo, guarda como 0/1. `undefined` (campo opcional
  // ausente do req.body, ex: "autor" ao cadastrar um livro sem preenchê-lo) também não pode
  // ser vinculado — o `pg` converte isso pra NULL sozinho, então o adaptador replica esse
  // comportamento aqui, senão toda controller precisaria lembrar de "campo || null" pra cada
  // valor opcional (um esquecimento já derrubou POST /api/livros com 500 no SQLite).
  function converterParams(params) {
    return (params || []).map(p => (p === true ? 1 : p === false ? 0 : p === undefined ? null : p));
  }

  function normalizarErro(err) {
    const codigo = MAPA_ERRO_SQLITE[err.errcode];
    if (codigo) err.code = codigo;
    return err;
  }

  // Migrations e o runner de seed mandam o arquivo inteiro (várias instruções separadas por
  // ";", sem parâmetros) — só dá pra rodar com .exec(). Toda query normal das controllers é
  // uma instrução só, com bind params, e usa .prepare().
  function ehMultiInstrucao(sql) {
    const instrucoes = sql.split(';').map(s => s.trim()).filter(Boolean);
    return instrucoes.length > 1;
  }

  // "::tipo" (cast do Postgres, ex: COUNT(*)::int) não é sintaxe válida no SQLite — dá erro
  // de parse, não só resultado diferente. SQLite não precisa do cast (já devolve número),
  // então só remove; aparece em dezenas de queries pra não precisar editar uma por uma.
  function removerCastsPostgres(sql) {
    return sql.replace(/::[a-zA-Z_][a-zA-Z0-9_]*(\[\])?/g, '');
  }

  // "SELECT ... FOR UPDATE" (trava de linha em transação) não é sintaxe válida no SQLite —
  // dá erro de parse. Não faz falta ali: o adaptador usa uma única conexão compartilhada
  // (sem pool de verdade) e cada instrução do node:sqlite roda de forma síncrona, então o
  // "BEGIN" de uma transação já impede o SQLite de aceitar outro "BEGIN" concorrente na
  // mesma conexão (erro explícito de transação aninhada, não corrupção silenciosa).
  function removerForUpdate(sql) {
    return sql.replace(/\s+FOR\s+UPDATE\b/gi, '');
  }

  // "SELECT COUNT(*) FROM ..." sem apelido: o Postgres nomeia a coluna "count" por padrão,
  // o SQLite nomeia literalmente "COUNT(*)" — todo `total = Number(rows[0].count)" (padrão
  // de paginação usado em quase toda listagem) quebraria silenciosamente (undefined, não
  // erro). Só renomeia quando COUNT(*) vem sozinho antes do FROM — não mexe nos casos que já
  // têm FILTER/alias próprio (ex: "COUNT(*) FILTER (WHERE ...) AS pendentes").
  function aliasContagemPadrao(sql) {
    return sql.replace(/COUNT\(\*\)(\s+FROM\s)/gi, 'COUNT(*) AS count$1');
  }

  // CURRENT_TIMESTAMP do SQLite grava "YYYY-MM-DD HH:MM:SS" (UTC, sem indicar isso). Sem o
  // "Z", `new Date(...)` (no Node e no navegador) interpreta a string como horário LOCAL, não
  // UTC — desloca o valor pelo fuso do processo (ex: 3h em America/Sao_Paulo), o que já
  // quebrou a checagem de sessão (tokens_validos_apos) logo após login. Normaliza toda string
  // nesse formato pra ISO 8601 com "Z" explícito antes de devolver — assim qualquer consumidor
  // (backend ou frontend, via JSON) interpreta certo sem precisar saber que o motor é SQLite.
  const REGEX_TIMESTAMP_SQLITE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;
  function normalizarTimestamps(rows) {
    for (const row of rows) {
      for (const chave in row) {
        const valor = row[chave];
        if (typeof valor === 'string' && REGEX_TIMESTAMP_SQLITE.test(valor)) {
          row[chave] = valor.replace(' ', 'T') + 'Z';
        }
      }
    }
    return rows;
  }

  // "$1" repetido na mesma query (ex: "titulo_busca LIKE $1 OR autor_busca LIKE $1") só
  // consome 1 valor do array de params no Postgres — o driver `pg` sabe reaproveitar. O `?`
  // do SQLite é posicional simples: cada ocorrência consome o PRÓXIMO valor, sem entender
  // reaproveitamento. Só trocar "$N" por "?" sem também duplicar o valor correspondente
  // desalinha tudo a partir daí (LIMIT/OFFSET acabam recebendo o valor errado, ou nenhum).
  // Por isso a tradução do texto e a expansão do array de params têm que andar juntas.
  function traduzirPlaceholders(sql, params) {
    if (!params) return { sql, params };
    const paramsExpandido = [];
    const sqlTraduzido = sql.replace(/\$(\d+)/g, (_, n) => {
      paramsExpandido.push(params[Number(n) - 1]);
      return '?';
    });
    return { sql: sqlTraduzido, params: paramsExpandido };
  }

  function executar(sql, params) {
    const sqlPreTraduzido = aliasContagemPadrao(removerForUpdate(removerCastsPostgres(sql)));
    const { sql: sqlTraduzido, params: paramsTraduzidos } = traduzirPlaceholders(sqlPreTraduzido, params);
    const comando = sqlTraduzido.trim().toUpperCase();

    try {
      if (comando === 'BEGIN' || comando === 'COMMIT' || comando === 'ROLLBACK') {
        db.exec(comando);
        return { rows: [], rowCount: 0 };
      }

      if (!params && ehMultiInstrucao(sqlTraduzido)) {
        db.exec(sqlTraduzido);
        return { rows: [], rowCount: 0 };
      }

      const stmt = db.prepare(sqlTraduzido);
      const precisaLinhas = comando.startsWith('SELECT') || comando.includes('RETURNING');
      if (precisaLinhas) {
        const rows = normalizarTimestamps(stmt.all(...converterParams(paramsTraduzidos)));
        return { rows, rowCount: rows.length };
      }
      const resultado = stmt.run(...converterParams(paramsTraduzidos));
      return { rows: [], rowCount: resultado.changes };
    } catch (err) {
      throw normalizarErro(err);
    }
  }

  const adaptador = {
    query: async (sql, params) => executar(sql, params),
    connect: async () => ({
      query: async (sql, params) => executar(sql, params),
      release: () => {},
    }),
    end: async () => db.close(),
    usaSqlite: true,
  };
  return adaptador;
}

const pool = usaPostgres ? criarAdaptadorPostgres() : criarAdaptadorSqlite();
// Flag simples pras controllers que têm SQL genuinamente diferente entre os dois motores
// (aritmética de data, agregação de array) saberem qual ramo usar, sem cada uma checar
// process.env.DATABASE_URL de novo. pg.Pool não tem essa propriedade, então fica undefined
// (falsy) nesse caso — só é `true` quando o adaptador SQLite é quem está ativo.
pool.usaSqlite = pool.usaSqlite || false;

module.exports = pool;
