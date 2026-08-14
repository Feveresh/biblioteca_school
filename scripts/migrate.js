// Runner mínimo de migrations, sem dependência de ORM/lib externa.
// Uso: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { aplicarMigrations } = require('../utils/aplicarMigrations');

const usaSqlite = !process.env.DATABASE_URL;
const DIR_MIGRATIONS = path.join(__dirname, '..', 'sql', 'migrations', usaSqlite ? 'sqlite' : 'pg');

async function migrate() {
  const client = await pool.connect();
  try {
    if (usaSqlite) {
      // SQLite não tem histórico de migrations antigas pra reaplicar — banco totalmente
      // novo (schema_migrations ainda não existe) recebe o schema completo de uma vez.
      const { rows } = await client.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      );
      if (!rows.length) {
        const schemaCompleto = fs.readFileSync(
          path.join(__dirname, '..', 'sql', 'schema.sqlite.sql'), 'utf8'
        );
        await client.query(schemaCompleto);
        console.log('✅ Schema SQLite criado (instalação nova).');
      }
    } else {
      // As migrations incrementais (sql/migrations/pg/) presumem uma linha de base que já
      // existia antes desse sistema de migrations (ex: a tabela "users") — não bastam
      // sozinhas pra um banco Postgres genuinamente vazio (uso avançado: apontar a
      // instalação pra um Postgres novo em vez do SQLite padrão). Detecta esse caso pela
      // ausência de QUALQUER tabela em "public" e usa o snapshot cumulativo completo
      // (schema.sql — o mesmo caminho que uma instalação nova em Postgres já documentava),
      // que já cria e semeia "schema_migrations" sozinho.
      const { rows: tabelasExistentes } = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1"
      );
      if (!tabelasExistentes.length) {
        const schemaCompleto = fs.readFileSync(
          path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8'
        );
        await client.query(schemaCompleto);
        console.log('✅ Schema PostgreSQL criado (instalação nova).');
      } else {
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            nome        VARCHAR(255) PRIMARY KEY,
            aplicado_em TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
      }
    }

    const executadas = await aplicarMigrations(client, DIR_MIGRATIONS);
    console.log(executadas ? `\n${executadas} migration(s) aplicada(s).` : '\nNada a aplicar, banco já está atualizado.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('❌ Erro na migração:', err.message);
  process.exit(1);
});
