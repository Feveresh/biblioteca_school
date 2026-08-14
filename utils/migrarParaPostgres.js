const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const CAMINHO_SCHEMA_PG = path.join(__dirname, '..', 'sql', 'schema.sql');

// Ordem de dependência (FK) — cada tabela só é copiada depois das que ela referencia.
// "serial" marca colunas com sequência auto-incrementada (precisa realinhar depois de
// copiar os ids explícitos); "bool" marca colunas que o SQLite guarda como 0/1 e o
// Postgres espera como true/false.
const TABELAS = [
  { nome: 'permissoes',       pk: ['codigo'] },
  { nome: 'roles',            pk: ['id'], serial: 'id', bool: ['acesso_total', 'sistema'] },
  { nome: 'role_permissoes',  pk: ['role_id', 'permissao_codigo'] },
  { nome: 'generos',          pk: ['id'], serial: 'id' },
  { nome: 'turmas',           pk: ['id'], serial: 'id' },
  { nome: 'users',            pk: ['id'], serial: 'id', bool: ['ativo'] },
  { nome: 'livros',           pk: ['id'], serial: 'id', bool: ['disponivel'] },
  { nome: 'alunos',           pk: ['id'], serial: 'id' },
  { nome: 'emprestimos',      pk: ['id'], serial: 'id' },
  { nome: 'configuracoes',    pk: ['id'], bool: ['permitir_acesso_rede'] },
  { nome: 'login_tentativas', pk: ['id'], serial: 'id', bool: ['sucesso'] },
  { nome: 'log_auditoria',    pk: ['id'], serial: 'id' },
];

async function testarConexao(connectionString) {
  const pgPool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await pgPool.query('SELECT 1');
  } finally {
    await pgPool.end();
  }
}

// Colunas TIMESTAMP (com hora) vêm do adaptador SQLite já como string ISO em UTC, tipo
// "2026-08-14T14:32:10.123Z" (ver normalizarTimestamps em config/db.js). Datas puras
// ("data_emprestimo" etc, formato "AAAA-MM-DD", sem hora) não caem nesse regex — sem
// horário, não há fuso pra confundir, então passam direto sem problema.
const REGEX_TIMESTAMP_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function normalizarValor(valor, coluna, tabela) {
  if (tabela.bool?.includes(coluna) && (valor === 0 || valor === 1)) {
    return valor === 1;
  }
  // As colunas TIMESTAMP do Postgres aqui são "sem fuso" (ver sql/schema.sql). Gravar a
  // STRING ISO direto faz o Postgres ignorar o "Z" e guardar os dígitos literalmente; na
  // leitura, o driver "pg" reinterpreta esses dígitos como horário LOCAL do processo — o
  // resultado sai deslocado pelo fuso do servidor (3h a mais em America/Sao_Paulo). Um
  // objeto Date, em vez de string, faz o "pg" serializar certo pro fuso da sessão na escrita,
  // e o valor volta correto na leitura. Já pegou "tokens_validos_apos" (usuário deslogado
  // sozinho até o relógio real alcançar o horário errado) — mesma classe afeta created_at,
  // criado_em, atualizado_em.
  if (typeof valor === 'string' && REGEX_TIMESTAMP_ISO_UTC.test(valor)) {
    return new Date(valor);
  }
  return valor;
}

async function copiarTabela(pgClient, tabela) {
  const { rows } = await pool.query(`SELECT * FROM ${tabela.nome}`);
  if (!rows.length) return { tabela: tabela.nome, origem: 0, destino: 0 };

  const colunas = Object.keys(rows[0]);
  const colunasNaoChave = colunas.filter(c => !tabela.pk.includes(c));
  const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
  // ON CONFLICT DO UPDATE (não INSERT puro): o schema novo do Postgres já vem com o catálogo
  // padrão semeado pelas próprias migrations (papéis Admin/Bibliotecário, permissões, gêneros
  // etc.) — copiar preservando os ids originais e "upsertando" concilia esses defaults com o
  // que veio do SQLite sem duplicar nem falhar por chave já existente.
  const onConflict = colunasNaoChave.length
    ? `ON CONFLICT (${tabela.pk.join(',')}) DO UPDATE SET ${colunasNaoChave.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`
    : `ON CONFLICT (${tabela.pk.join(',')}) DO NOTHING`;

  for (const row of rows) {
    const valores = colunas.map(c => normalizarValor(row[c], c, tabela));
    await pgClient.query(
      `INSERT INTO ${tabela.nome} (${colunas.join(', ')}) VALUES (${placeholders}) ${onConflict}`,
      valores
    );
  }

  // Os ids foram inseridos explicitamente (pra manter as foreign keys entre tabelas
  // coerentes) — sem isso a sequência do Postgres continuaria em 1 e o próximo INSERT sem
  // id explícito (uso normal do sistema) colidiria com um id que acabou de ser copiado.
  if (tabela.serial) {
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('${tabela.nome}', '${tabela.serial}'), COALESCE((SELECT MAX(${tabela.serial}) FROM ${tabela.nome}), 1))`
    );
  }

  const { rows: totalDestino } = await pgClient.query(`SELECT COUNT(*) AS count FROM ${tabela.nome}`);
  return { tabela: tabela.nome, origem: rows.length, destino: Number(totalDestino[0].count) };
}

// Copia todos os dados do SQLite pro Postgres de destino. Idempotente — usa ON CONFLICT em
// vez de INSERT puro, então pode ser chamada de novo com segurança se falhar no meio (ex:
// conexão caiu). NÃO mexe no SQLite nem no .env — é sempre seguro rodar isso a qualquer
// momento só pra conferir se a cópia bate, sem risco de perder dado nenhum.
async function copiarDados(connectionString) {
  if (!pool.usaSqlite) {
    throw new Error('A migração só é permitida partindo do SQLite (o sistema já está usando PostgreSQL).');
  }

  const pgPool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  const relatorio = [];
  try {
    const client = await pgPool.connect();
    try {
      // As migrations incrementais (sql/migrations/pg/) presumem uma linha de base que já
      // existia antes desse sistema de migrations — não são autossuficientes pra um banco
      // vazio. `schema.sql` é o snapshot cumulativo completo, feito exatamente pra isso (é o
      // mesmo caminho que uma instalação nova em Postgres já usaria).
      // "schema_migrations" já existir é o sinal de que uma tentativa anterior desta mesma
      // ferramenta já rodou aqui (a cópia de dados é idempotente e pode ser tentada de novo
      // com segurança) — só roda o schema.sql na primeira vez. Qualquer OUTRA tabela presente
      // sem isso indica banco já em uso por outra coisa — recusa, pra não sobrescrever por engano.
      const { rows: jaInicializado } = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations'"
      );
      if (!jaInicializado.length) {
        const { rows: tabelasExistentes } = await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1"
        );
        if (tabelasExistentes.length) {
          throw new Error('O banco PostgreSQL de destino não está vazio. Aponte para um banco novo, sem tabelas.');
        }
        const schemaCompleto = fs.readFileSync(CAMINHO_SCHEMA_PG, 'utf8');
        await client.query(schemaCompleto);
      }

      for (const tabela of TABELAS) {
        relatorio.push(await copiarTabela(client, tabela));
      }
    } finally {
      client.release();
    }
  } finally {
    await pgPool.end();
  }

  const comProblema = relatorio.filter(r => r.destino < r.origem);
  if (comProblema.length) {
    throw new Error(`A contagem de linhas não bateu em: ${comProblema.map(r => r.tabela).join(', ')}. Nada foi apagado do SQLite.`);
  }

  return relatorio;
}

// Ponto sem volta: esvazia o SQLite e aponta o .env pro PostgreSQL. Só deve ser chamado
// depois que `copiarDados` já confirmou que tudo foi copiado com sucesso — e mesmo assim
// reconfere a cópia de novo aqui antes de apagar qualquer coisa, caso algo tenha mudado
// entre a conferência anterior e a confirmação do administrador.
async function finalizarMigracao(connectionString) {
  if (!pool.usaSqlite) {
    throw new Error('A migração só é permitida partindo do SQLite (o sistema já está usando PostgreSQL).');
  }

  const relatorio = await copiarDados(connectionString);

  // Backup de segurança do SQLite antes de apagar — VACUUM INTO gera uma cópia consistente
  // mesmo com o banco em modo WAL (uma cópia de arquivo bruta poderia pegar o banco no meio
  // de uma escrita).
  const caminhoDb = process.env.DB_SQLITE_PATH || path.join(__dirname, '..', 'biblioteca.db');
  const caminhoBackup = `${caminhoDb}.backup-${Date.now()}`;
  await pool.query(`VACUUM INTO '${caminhoBackup.replace(/'/g, "''")}'`);

  await pool.query('BEGIN');
  try {
    // Ordem inversa da cópia, pra respeitar as foreign keys na hora de apagar.
    for (const tabela of [...TABELAS].reverse()) {
      await pool.query(`DELETE FROM ${tabela.nome}`);
    }
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }

  const caminhoEnv = path.join(__dirname, '..', '.env');
  let conteudo = fs.readFileSync(caminhoEnv, 'utf8');
  conteudo = /^DATABASE_URL=.*$/m.test(conteudo)
    ? conteudo.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${connectionString}`)
    : `DATABASE_URL=${connectionString}\n${conteudo}`;
  fs.writeFileSync(caminhoEnv, conteudo);

  return { relatorio, backupSqlite: caminhoBackup };
}

module.exports = { testarConexao, copiarDados, finalizarMigracao };
