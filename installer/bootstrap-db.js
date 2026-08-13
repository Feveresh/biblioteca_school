// Roda durante a instalação/atualização via Inno Setup (empacotado em scripts/ do app,
// pra ter acesso ao node_modules já vendorizado — precisa de "pg" e "bcryptjs").
//
// - Instalação nova (.env ainda não existe): cria uma role e um banco dedicados no
//   Postgres (usando a senha de administrador informada no instalador, disponível na
//   variável de ambiente PG_SUPERUSER_SENHA), gera .env com credenciais só da app e um
//   JWT_SECRET aleatório, e cria o usuário Admin inicial (senha aleatória, salva em
//   LEIA-ME.txt).
// - Atualização (.env já existe): não mexe em credenciais nem cria nada — só roda as
//   migrations pendentes, preservando todos os dados reais.
//
// Uso: node scripts/bootstrap-db.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const APP_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(APP_DIR, '.env');
const LEIA_ME_PATH = path.join(APP_DIR, 'LEIA-ME.txt');

const APP_DB = 'biblioteca';
const APP_ROLE = 'biblioteca_app';
const PG_HOST = 'localhost';
const PG_PORT = 5432;

function senhaAleatoria(tamanho = 24) {
  return crypto.randomBytes(tamanho).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, tamanho);
}

async function criarBancoEUsuario() {
  const { Client } = require('pg');
  const senhaSuperuser = process.env.PG_SUPERUSER_SENHA;
  if (!senhaSuperuser) {
    throw new Error('PG_SUPERUSER_SENHA não informada — necessária pra criar o banco na primeira instalação.');
  }

  const admin = new Client({
    host: PG_HOST, port: PG_PORT, user: 'postgres', password: senhaSuperuser, database: 'postgres',
  });
  await admin.connect();

  const senhaApp = senhaAleatoria();
  const { rows: papel } = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_ROLE]);
  if (papel.length) {
    await admin.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${senhaApp}'`);
  } else {
    await admin.query(`CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${senhaApp}'`);
  }

  const { rows: banco } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [APP_DB]);
  if (!banco.length) {
    await admin.query(`CREATE DATABASE ${APP_DB} OWNER ${APP_ROLE}`);
  }
  await admin.end();

  const jwtSecret = crypto.randomBytes(48).toString('hex');
  const conteudoEnv = [
    `DATABASE_URL=postgresql://${APP_ROLE}:${senhaApp}@${PG_HOST}:${PG_PORT}/${APP_DB}`,
    `PORT=3303`,
    `JWT_SECRET=${jwtSecret}`,
    '',
  ].join('\n');
  fs.writeFileSync(ENV_PATH, conteudoEnv, 'utf8');
  console.log('✅ .env gerado com credenciais dedicadas.');
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
  const instalacaoNova = !fs.existsSync(ENV_PATH);

  if (instalacaoNova) {
    console.log('== Instalação nova: criando banco e credenciais ==');
    await criarBancoEUsuario();
  } else {
    console.log('== Atualização: mantendo banco e credenciais existentes ==');
  }

  console.log('== Aplicando migrations ==');
  execFileSync(process.execPath, [path.join(__dirname, 'migrate.js')], {
    cwd: APP_DIR, stdio: 'inherit',
  });

  if (instalacaoNova) await criarAdminInicial();
}

main().catch(err => {
  console.error('❌ Erro no bootstrap:', err.message);
  process.exit(1);
});
