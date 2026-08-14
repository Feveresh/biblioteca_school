const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const pool = require('../config/db');
const { compararVersoes } = require('./compararVersoes');
const versaoAtual = require('../package.json').version;

const CAMINHO_ESTADO = path.join(__dirname, '..', '.atualizacao-estado.json');

function lerEstado() {
  try {
    return JSON.parse(fs.readFileSync(CAMINHO_ESTADO, 'utf8'));
  } catch {
    return { atualizando: false };
  }
}

function escreverEstado(estado) {
  fs.writeFileSync(CAMINHO_ESTADO, JSON.stringify(estado), 'utf8');
}

// Chamada uma vez, na subida do processo (app.js) — a presença do arquivo de estado
// significa que uma atualização estava em andamento quando o processo anterior morreu (o
// próprio instalador para o serviço no meio do processo); ter chegado até aqui, de pé e
// rodando o código novo, já é a prova de que deu certo — não sobra rastro de qual foi a
// última fase, então não tem como (nem falta) reportar "concluído" explicitamente.
function limparEstadoNaSubida() {
  try {
    fs.unlinkSync(CAMINHO_ESTADO);
  } catch {
    // normal não existir (processo subindo sem nenhuma atualização em andamento)
  }
}

// Sem servidor de verificação configurado (padrão) = nunca tenta nada pela rede.
async function verificarAtualizacao() {
  const { rows } = await pool.query('SELECT url_verificacao_atualizacao FROM configuracoes WHERE id = 1');
  const url = rows[0]?.url_verificacao_atualizacao;
  if (!url) return { temAtualizacao: false };

  try {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 5000);
    const resp = await fetch(url, { signal: controlador.signal });
    clearTimeout(timeout);
    if (!resp.ok) return { temAtualizacao: false };

    const dados = await resp.json();
    if (!dados?.versao || !dados?.urlDownload) return { temAtualizacao: false };

    if (compararVersoes(dados.versao, versaoAtual) <= 0) return { temAtualizacao: false };

    return {
      temAtualizacao: true,
      versaoAtual,
      versaoDisponivel: dados.versao,
      notas: dados.notas || '',
      urlDownload: dados.urlDownload,
    };
  } catch {
    // servidor de verificação fora do ar, URL inválida, timeout, JSON malformado etc. —
    // nunca deve quebrar o login por causa disso, só significa "sem atualização por ora".
    return { temAtualizacao: false };
  }
}

async function baixarArquivo(url, destino, aoProgredir) {
  const resp = await fetch(url);
  if (!resp.ok || !resp.body) throw new Error(`Falha ao baixar o instalador (HTTP ${resp.status})`);

  const totalBytes = Number(resp.headers.get('content-length')) || 0;
  let recebidos = 0;
  let ultimoPercentualReportado = -1;

  const destinoStream = fs.createWriteStream(destino);
  const leitor = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      recebidos += value.length;
      await new Promise((resolve, reject) => destinoStream.write(value, err => err ? reject(err) : resolve()));

      if (totalBytes) {
        const percentual = Math.min(99, Math.round((recebidos / totalBytes) * 100));
        if (percentual !== ultimoPercentualReportado) {
          ultimoPercentualReportado = percentual;
          aoProgredir(percentual);
        }
      }
    }
  } finally {
    await new Promise((resolve, reject) => destinoStream.end(err => err ? reject(err) : resolve()));
  }
}

async function executarAtualizacao({ urlDownload, versao }) {
  try {
    const caminhoTemp = path.join(os.tmpdir(), 'BibliotecaEscolar-Update.exe');

    await baixarArquivo(urlDownload, caminhoTemp, (percentual) => {
      escreverEstado({ atualizando: true, fase: 'baixando', progresso: percentual, versao });
    });

    escreverEstado({ atualizando: true, fase: 'instalando', progresso: 100, versao });

    // Silencioso (sem janelas do instalador) e sem reiniciar o Windows — o próprio
    // instalador já sabe parar/reconfigurar/reiniciar o serviço (ver biblioteca.iss).
    // "detached" + "unref": o processo filho sobrevive independente deste processo, que
    // está prestes a ser derrubado pelo próprio instalador (ele para o serviço antes de
    // copiar os arquivos novos).
    spawn(caminhoTemp, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], {
      detached: true, stdio: 'ignore',
    }).unref();

    escreverEstado({ atualizando: true, fase: 'reiniciando', progresso: 100, versao });
  } catch (err) {
    escreverEstado({ atualizando: true, fase: 'erro', erro: err.message, versao });
  }
}

// Dispara a atualização em segundo plano e retorna assim que ela começa (não espera o
// processo inteiro — o download sozinho já pode levar dezenas de segundos). Sempre reconfere
// a verificação no servidor aqui dentro (nunca confia num urlDownload vindo do cliente —
// isso seria deixar qualquer requisição mandar o servidor baixar e rodar um binário
// arbitrário como o próprio serviço do Windows).
async function iniciarAtualizacao() {
  if (lerEstado().atualizando) {
    throw new Error('Já existe uma atualização em andamento.');
  }

  const verificacao = await verificarAtualizacao();
  if (!verificacao.temAtualizacao) {
    throw new Error('Nenhuma atualização disponível no momento.');
  }

  escreverEstado({ atualizando: true, fase: 'baixando', progresso: 0, versao: verificacao.versaoDisponivel });
  executarAtualizacao({ urlDownload: verificacao.urlDownload, versao: verificacao.versaoDisponivel })
    .catch(err => escreverEstado({ atualizando: true, fase: 'erro', erro: err.message, versao: verificacao.versaoDisponivel }));

  return verificacao;
}

function cancelarEstadoDeErro() {
  const estado = lerEstado();
  if (estado.atualizando && estado.fase === 'erro') limparEstadoNaSubida();
}

module.exports = {
  lerEstado,
  limparEstadoNaSubida,
  verificarAtualizacao,
  iniciarAtualizacao,
  cancelarEstadoDeErro,
};
