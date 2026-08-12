// Runner mínimo de migrations, sem dependência de ORM/lib externa.
// Uso: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const DIR_MIGRATIONS = path.join(__dirname, '..', 'sql', 'migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome        VARCHAR(255) PRIMARY KEY,
        aplicado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: aplicadas } = await client.query('SELECT nome FROM schema_migrations');
    const jaAplicadas = new Set(aplicadas.map(r => r.nome));

    const arquivos = fs.readdirSync(DIR_MIGRATIONS)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let executadas = 0;
    for (const arquivo of arquivos) {
      if (jaAplicadas.has(arquivo)) continue;

      const sql = fs.readFileSync(path.join(DIR_MIGRATIONS, arquivo), 'utf8');
      console.log(`→ Aplicando ${arquivo}...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
        console.log(`✅ ${arquivo} aplicada.`);
        executadas++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha ao aplicar ${arquivo}: ${err.message}`);
      }
    }

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
