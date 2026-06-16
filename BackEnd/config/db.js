require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL conectado'))
  .catch(err => console.error('❌ Erro na conexão:', err.message));

module.exports = pool;