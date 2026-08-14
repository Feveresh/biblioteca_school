const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const CAMINHO_SCHEMA_SQLITE = path.join(__dirname, '..', 'sql', 'schema.sqlite.sql');

// Mesma ordem de dependência (FK) do sentido contrário. Diferente de migrarParaPostgres.js,
// não precisa de "serial" (realinhar sequência) — o AUTOINCREMENT do SQLite já continua
// sozinho a partir do maior id inserido, mesmo quando o id veio explícito no INSERT.
// "data" marca colunas DATE (sem hora) — precisam de tratamento à parte de TIMESTAMP.
const TABELAS = [
  { nome: 'permissoes',       pk: ['codigo'] },
  { nome: 'roles',            pk: ['id'], bool: ['acesso_total', 'sistema'] },
  { nome: 'role_permissoes',  pk: ['role_id', 'permissao_codigo'] },
  { nome: 'generos',          pk: ['id'] },
  { nome: 'turmas',           pk: ['id'] },
  { nome: 'users',            pk: ['id'], bool: ['ativo'] },
  { nome: 'livros',           pk: ['id'], bool: ['disponivel'] },
  { nome: 'alunos',           pk: ['id'] },
  { nome: 'emprestimos',      pk: ['id'], data: ['data_emprestimo', 'data_prevista', 'data_devolucao'] },
  { nome: 'configuracoes',    pk: ['id'], bool: ['permitir_acesso_rede'] },
  { nome: 'login_tentativas', pk: ['id'], bool: ['sucesso'] },
  { nome: 'log_auditoria',    pk: ['id'] },
];

function caminhoDestinoPadrao() {
  return process.env.DB_SQLITE_PATH || path.join(__dirname, '..', 'biblioteca.db');
}

// O driver "pg" já desserializa timestamp/date pra objeto Date do JS e jsonb pra objeto —
// aqui é a volta: cada um vira o formato que o SQLite (TEXT) espera.
function normalizarValor(valor, coluna, tabela) {
  if (valor === null || valor === undefined) return valor;
  if (tabela.bool?.includes(coluna)) return valor ? 1 : 0;
  if (valor instanceof Date) {
    if (tabela.data?.includes(coluna)) {
      // Coluna DATE: o "pg" devolve um Date representando a meia-noite LOCAL do dia certo —
      // usar os getters locais (não toISOString/UTC) é o que garante não deslocar um dia
      // dependendo do fuso horário do servidor.
      const ano = valor.getFullYear();
      const mes = String(valor.getMonth() + 1).padStart(2, '0');
      const dia = String(valor.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }
    return valor.toISOString(); // coluna TIMESTAMP
  }
  if (typeof valor === 'object') return JSON.stringify(valor); // JSONB
  return valor;
}

async function copiarTabela(db, tabela) {
  const { rows } = await pool.query(`SELECT * FROM ${tabela.nome}`);
  if (!rows.length) return { tabela: tabela.nome, origem: 0, destino: 0 };

  const colunas = Object.keys(rows[0]);
  const colunasNaoChave = colunas.filter(c => !tabela.pk.includes(c));
  const placeholders = colunas.map(() => '?').join(', ');
  const onConflict = colunasNaoChave.length
    ? `ON CONFLICT (${tabela.pk.join(',')}) DO UPDATE SET ${colunasNaoChave.map(c => `${c} = excluded.${c}`).join(', ')}`
    : `ON CONFLICT (${tabela.pk.join(',')}) DO NOTHING`;

  const stmt = db.prepare(`INSERT INTO ${tabela.nome} (${colunas.join(', ')}) VALUES (${placeholders}) ${onConflict}`);
  for (const row of rows) {
    stmt.run(...colunas.map(c => normalizarValor(row[c], c, tabela)));
  }

  const totalDestino = db.prepare(`SELECT COUNT(*) AS count FROM ${tabela.nome}`).get();
  return { tabela: tabela.nome, origem: rows.length, destino: Number(totalDestino.count) };
}

// Copia todos os dados do PostgreSQL atual pro arquivo SQLite padrão (o mesmo caminho que o
// sistema passaria a usar depois — DB_SQLITE_PATH ou biblioteca.db na raiz). Idempotente:
// pode ser chamada de novo com segurança (ON CONFLICT em vez de INSERT puro). NÃO mexe no
// PostgreSQL nem no .env — sempre seguro rodar só pra conferir.
async function copiarDados() {
  if (pool.usaSqlite) {
    throw new Error('A migração só é permitida partindo do PostgreSQL (o sistema já está usando SQLite).');
  }

  const caminhoDestino = caminhoDestinoPadrao();
  const db = new DatabaseSync(caminhoDestino);
  db.exec('PRAGMA foreign_keys = ON');

  const relatorio = [];
  try {
    // Mesma lógica do sentido contrário: "schema_migrations" já existir é o sinal de uma
    // tentativa anterior desta mesma ferramenta (retry seguro). Qualquer OUTRA tabela sem
    // isso indica um arquivo SQLite de verdade já em uso — recusa, pra não misturar dados.
    const jaInicializado = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
    ).all();
    if (!jaInicializado.length) {
      const outrasTabelas = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all();
      if (outrasTabelas.length) {
        throw new Error(`O arquivo SQLite de destino (${caminhoDestino}) já existe e não está vazio. Mova ou apague esse arquivo antes de migrar.`);
      }
      db.exec(fs.readFileSync(CAMINHO_SCHEMA_SQLITE, 'utf8'));
    }

    for (const tabela of TABELAS) {
      relatorio.push(await copiarTabela(db, tabela));
    }
  } finally {
    db.close();
  }

  const comProblema = relatorio.filter(r => r.destino < r.origem);
  if (comProblema.length) {
    throw new Error(`A contagem de linhas não bateu em: ${comProblema.map(r => r.tabela).join(', ')}. O PostgreSQL continua sendo usado normalmente.`);
  }

  return relatorio;
}

// Ponto sem volta (mas bem menos destrutivo que o sentido contrário): reconfere a cópia e
// aponta o .env pro SQLite recém-criado. Ao contrário de finalizarMigracao() em
// migrarParaPostgres.js, NÃO apaga nada do PostgreSQL — é um servidor compartilhado, que
// pode ter outros usos, backups ou ser gerenciado à parte; o arquivo SQLite é que é local e
// descartável. O Postgres continua intacto e disponível caso precise migrar de volta.
async function finalizarMigracao() {
  if (pool.usaSqlite) {
    throw new Error('A migração só é permitida partindo do PostgreSQL (o sistema já está usando SQLite).');
  }

  const relatorio = await copiarDados();

  const caminhoEnv = path.join(__dirname, '..', '.env');
  let conteudo = fs.readFileSync(caminhoEnv, 'utf8');
  conteudo = conteudo.replace(/^DATABASE_URL=.*\r?\n?/m, '');
  fs.writeFileSync(caminhoEnv, conteudo);

  return { relatorio, caminhoSqlite: caminhoDestinoPadrao() };
}

module.exports = { copiarDados, finalizarMigracao, caminhoDestinoPadrao };
