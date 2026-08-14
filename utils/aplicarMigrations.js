const fs = require('fs');
const path = require('path');

// Aplica as migrations pendentes de um diretório contra um client já conectado — usado tanto
// por `npm run migrate` quanto pela ferramenta de migração SQLite→PostgreSQL (que precisa
// montar o schema do zero num Postgres novo antes de copiar os dados pra lá). O caller é
// responsável por garantir que a tabela `schema_migrations` já existe antes de chamar isso.
async function aplicarMigrations(client, dirMigrations) {
  const { rows: aplicadas } = await client.query('SELECT nome FROM schema_migrations');
  const jaAplicadas = new Set(aplicadas.map(r => r.nome));

  const arquivos = fs.readdirSync(dirMigrations)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let executadas = 0;
  for (const arquivo of arquivos) {
    if (jaAplicadas.has(arquivo)) continue;

    const sql = fs.readFileSync(path.join(dirMigrations, arquivo), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
      await client.query('COMMIT');
      executadas++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falha ao aplicar ${arquivo}: ${err.message}`);
    }
  }
  return executadas;
}

module.exports = { aplicarMigrations };
