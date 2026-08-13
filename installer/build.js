// Monta o staging de produção que o Inno Setup empacota: código da app (sem dev
// dependencies), runtime portátil do Node e o NSSM (pra rodar como Windows Service).
// Uso: node installer/build.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const DIST = path.join(__dirname, 'dist');
const APP_DIST = path.join(DIST, 'app');
const RUNTIME_DIST = path.join(DIST, 'runtime');
const TOOLS_DIST = path.join(DIST, 'tools');

const NODE_VERSION = '24.15.0';
const NODE_ZIP_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
const NODE_ZIP_NOME = `node-v${NODE_VERSION}-win-x64.zip`;

const NSSM_VERSION = '2.24';
const NSSM_ZIP_URL = `https://nssm.cc/release/nssm-${NSSM_VERSION}.zip`;
const NSSM_ZIP_NOME = `nssm-${NSSM_VERSION}.zip`;

// Só o que a app precisa em produção — sem .git, .claude, backups, etc.
const ITENS_APP = [
  'app.js', 'package.json', 'package-lock.json', '.env.example',
  'config', 'controllers', 'middleware', 'routes', 'scripts', 'sql', 'utils', 'public',
];

function rodar(comando, args, opcoes = {}) {
  const r = spawnSync(comando, args, { stdio: 'inherit', shell: true, ...opcoes });
  if (r.status !== 0) {
    throw new Error(`Comando falhou (${r.status}): ${comando} ${args.join(' ')}`);
  }
}

async function baixarSeNecessario(url, nomeArquivo) {
  fs.mkdirSync(CACHE, { recursive: true });
  const destino = path.join(CACHE, nomeArquivo);
  if (fs.existsSync(destino)) {
    console.log(`↺ Já em cache: ${nomeArquivo}`);
    return destino;
  }
  console.log(`↓ Baixando ${nomeArquivo}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(destino, buffer);
  console.log(`✅ Baixado ${nomeArquivo} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  return destino;
}

function extrairZip(zipPath, destinoPasta) {
  fs.mkdirSync(destinoPasta, { recursive: true });
  rodar('powershell', [
    '-NoProfile', '-Command',
    `Expand-Archive -Path "${zipPath}" -DestinationPath "${destinoPasta}" -Force`,
  ]);
}

async function main() {
  console.log('== 1/5: limpando staging anterior ==');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(APP_DIST, { recursive: true });
  fs.mkdirSync(RUNTIME_DIST, { recursive: true });
  fs.mkdirSync(TOOLS_DIST, { recursive: true });

  console.log('== 2/5: copiando código da aplicação ==');
  for (const item of ITENS_APP) {
    const origem = path.join(RAIZ, item);
    if (!fs.existsSync(origem)) {
      console.log(`  (pulando "${item}", não existe)`);
      continue;
    }
    fs.cpSync(origem, path.join(APP_DIST, item), { recursive: true });
  }

  console.log('== 3/5: instalando dependências de produção ==');
  rodar('npm', ['ci', '--omit=dev'], { cwd: APP_DIST });

  // bootstrap-db.js precisa do node_modules da própria app (pg, bcryptjs, dotenv) —
  // por isso vai dentro de app/scripts, junto com migrate.js e seed.js.
  fs.copyFileSync(path.join(__dirname, 'bootstrap-db.js'), path.join(APP_DIST, 'scripts', 'bootstrap-db.js'));

  console.log('== 4/5: runtime portátil do Node ==');
  const nodeZip = await baixarSeNecessario(NODE_ZIP_URL, NODE_ZIP_NOME);
  const nodeExtraido = path.join(CACHE, `node-v${NODE_VERSION}-win-x64`);
  if (!fs.existsSync(nodeExtraido)) extrairZip(nodeZip, CACHE);
  fs.copyFileSync(path.join(nodeExtraido, 'node.exe'), path.join(RUNTIME_DIST, 'node.exe'));

  console.log('== 5/5: NSSM (Windows Service) ==');
  const nssmZip = await baixarSeNecessario(NSSM_ZIP_URL, NSSM_ZIP_NOME);
  const nssmExtraido = path.join(CACHE, `nssm-${NSSM_VERSION}`);
  if (!fs.existsSync(nssmExtraido)) extrairZip(nssmZip, CACHE);
  fs.copyFileSync(path.join(nssmExtraido, 'win64', 'nssm.exe'), path.join(TOOLS_DIST, 'nssm.exe'));

  console.log('\n✅ Staging pronto em installer/dist/');
  console.log(`   app/     — código + node_modules de produção`);
  console.log(`   runtime/ — node.exe portátil (v${NODE_VERSION})`);
  console.log(`   tools/   — nssm.exe (v${NSSM_VERSION})`);
}

main().catch(err => {
  console.error('❌ Erro no build:', err.message);
  process.exit(1);
});
