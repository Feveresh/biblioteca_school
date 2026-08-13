// Popula o banco com um usuário admin e alguns dados de exemplo.
// Uso: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const ADMIN = { nome: 'Administrador', email: 'admin@biblioteca.com', senha: 'admin123' };

const LIVROS = [
  { tombo: '0001', titulo: 'Dom Casmurro', autor: 'Machado de Assis' },
  { tombo: '0002', titulo: 'O Cortiço', autor: 'Aluísio Azevedo' },
  { tombo: '0003', titulo: 'Memórias Póstumas de Brás Cubas', autor: 'Machado de Assis' },
  { tombo: '0004', titulo: 'Capitães da Areia', autor: 'Jorge Amado' },
  { tombo: '0005', titulo: 'Vidas Secas', autor: 'Graciliano Ramos' },
  { tombo: '0006', titulo: 'Iracema', autor: 'José de Alencar' },
];

const ALUNOS = [
  { nome: 'Ana Beatriz Souza', turma: '9A' },
  { nome: 'Carlos Eduardo Lima', turma: '9A' },
  { nome: 'Fernanda Oliveira', turma: '8B' },
  { nome: 'João Pedro Santos', turma: '8B' },
];

async function seed() {
  const client = await pool.connect();
  try {
    const existente = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN.email]);
    if (!existente.rows[0]) {
      const papelAdmin = await client.query("SELECT id FROM roles WHERE nome = 'Admin'");
      if (!papelAdmin.rows[0]) {
        throw new Error('Papel "Admin" não encontrado — rode "npm run migrate" antes do seed.');
      }
      const senhaHash = await bcrypt.hash(ADMIN.senha, 10);
      await client.query(
        'INSERT INTO users (nome, email, senha_hash, role_id) VALUES ($1, $2, $3, $4)',
        [ADMIN.nome, ADMIN.email, senhaHash, papelAdmin.rows[0].id]
      );
      console.log(`✅ Usuário admin criado — email: ${ADMIN.email} / senha: ${ADMIN.senha}`);
    } else {
      console.log('ℹ️  Usuário admin já existe, pulando.');
    }

    for (const livro of LIVROS) {
      await client.query(
        `INSERT INTO livros (tombo, titulo, autor) VALUES ($1, $2, $3)
         ON CONFLICT (tombo) DO NOTHING`,
        [livro.tombo, livro.titulo, livro.autor]
      );
    }
    console.log(`✅ ${LIVROS.length} livros de exemplo garantidos.`);

    for (const aluno of ALUNOS) {
      const { rows: turmaRows } = await client.query(
        `INSERT INTO turmas (nome) VALUES ($1) ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
        [aluno.turma]
      );
      const existe = await client.query(
        'SELECT id FROM alunos WHERE nome = $1 AND turma_id = $2', [aluno.nome, turmaRows[0].id]
      );
      if (!existe.rows[0]) {
        await client.query('INSERT INTO alunos (nome, turma_id) VALUES ($1, $2)', [aluno.nome, turmaRows[0].id]);
      }
    }
    console.log(`✅ ${ALUNOS.length} alunos de exemplo garantidos.`);

    console.log('\nSeed concluído.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('❌ Erro ao popular o banco:', err.message);
  process.exit(1);
});
