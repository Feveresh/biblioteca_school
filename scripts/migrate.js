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
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          nome        VARCHAR(255) PRIMARY KEY,
          aplicado_em TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
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
