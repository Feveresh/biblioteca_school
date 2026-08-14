// Roda durante a instalação/atualização via Inno Setup (empacotado em scripts/ do app,
// pra ter acesso ao node_modules já vendorizado — precisa de "bcryptjs" e, se algum dia
// apontar pra PostgreSQL, também de "pg").
//
// - Instalação nova (.env ainda não existe): gera .env com JWT_SECRET aleatório — sem
//   DATABASE_URL, então o sistema sobe em SQLite (arquivo "biblioteca.db" na pasta de
//   instalação), sem precisar de nenhum banco externo instalado. Cria o usuário Admin
//   inicial (senha aleatória, salva em LEIA-ME.txt).
// - Atualização (.env já existe): não mexe em credenciais nem cria nada — só roda as
//   migrations pendentes, preservando todos os dados reais. Isso vale tanto pra quem
//   está em SQLite quanto pra quem colocou um DATABASE_URL de PostgreSQL no .env antes
//   de instalar/atualizar (uso avançado — o sistema respeita o que já estiver lá).
//
// Uso: node scripts/bootstrap-db.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const APP_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(APP_DIR, '.env');
const LEIA_ME_PATH = path.join(APP_DIR, 'LEIA-ME.txt');

function senhaAleatoria(tamanho = 24) {
  return crypto.randomBytes(tamanho).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, tamanho);
}

function gerarEnvSqlite() {
  const jwtSecret = crypto.randomBytes(48).toString('hex');
  const conteudoEnv = [
    `PORT=3303`,
    `JWT_SECRET=${jwtSecret}`,
    '',
  ].join('\n');
  fs.writeFileSync(ENV_PATH, conteudoEnv, 'utf8');
  console.log('✅ .env gerado (SQLite — sem necessidade de banco externo).');
}

async function criarAdminInicial() {
  require('dotenv').config({ path: ENV_PATH });
  const bcrypt = require('bcryptjs');
  const pool = require('../config/db');

  try {
    const { rows: existente } = await pool.query('SELECT id FROM users LIMIT 1');
    if (existente.length) {
      console.log('ℹ️  Já existe usuário cadastrado, não vou criar um Admin novo.');
      return;
    }

    const { rows: papelAdmin } = await pool.query("SELECT id FROM roles WHERE nome = 'Admin'");
    const senha = senhaAleatoria(12);
    const hash = await bcrypt.hash(senha, 10);
    await pool.query(
      'INSERT INTO users (nome, email, senha_hash, role_id) VALUES ($1, $2, $3, $4)',
      ['Administrador', 'admin@biblioteca.com', hash, papelAdmin[0].id]
    );

    fs.writeFileSync(LEIA_ME_PATH, [
      'Biblioteca Escolar — acesso inicial',
      '=====================================',
      '',
      `Endereço: http://localhost:${process.env.PORT || 3303}`,
      'E-mail: admin@biblioteca.com',
      `Senha: ${senha}`,
      '',
      'Troque essa senha assim que entrar, em "Gestão de Usuários" → "Redefinir senha".',
      '',
    ].join('\n'), 'utf8');
    console.log('✅ Usuário Admin inicial criado. Login salvo em LEIA-ME.txt.');
  } finally {
    await pool.end();
  }
}

async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.log('== Instalação nova: gerando configuração (SQLite) ==');
    gerarEnvSqlite();
  } else {
    console.log('== Atualização: mantendo banco e credenciais existentes ==');
  }

  console.log('== Aplicando migrations ==');
  execFileSync(process.execPath, [path.join(__dirname, 'migrate.js')], {
    cwd: APP_DIR, stdio: 'inherit',
  });

  // Sempre chama, mesmo quando o .env já existia (ex: alguém pré-criou um .env com
  // DATABASE_URL apontando pro próprio Postgres antes da primeira instalação) — a função
  // já é idempotente sozinha (só cria se a tabela "users" estiver vazia), então cobre tanto
  // a instalação nova em SQLite quanto esse caso avançado, sem deixar ninguém sem acesso.
  await criarAdminInicial();
}

main().catch(err => {
  console.error('❌ Erro no bootstrap:', err.message);
  process.exit(1);
});
