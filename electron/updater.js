const { app, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')
const {
  shouldCheckForUpdates,
  aceitarAtualizacao,
  classificarErroAtualizacao,
  sanitizarEstado,
} = require('./atualizacaoPolitica.js')

/** O PC da loja costuma ficar ligado o dia todo: volta a procurar de tempos em tempos. */
const INTERVALO_VERIFICACAO_MS = 4 * 60 * 60 * 1000

let estado = null
let ouvintesProntos = false
let verificacaoEmAndamento = false
let downloadEmAndamento = false
let instalacaoDisparada = false
let fase = 'verificar'
let intervalo = null

function deveVerificar() {
  return shouldCheckForUpdates({
    isPackaged: app.isPackaged,
    forceEnv: process.env.ORBULLETS_FORCE_UPDATES,
  })
}

function estadoInicial() {
  const versaoAtual = app.getVersion()
  if (!deveVerificar()) {
    return sanitizarEstado(
      {
        status: 'dev',
        mensagem: 'Verificação de atualização desativada no modo de desenvolvimento.',
      },
      versaoAtual,
    )
  }
  return sanitizarEstado({ status: 'idle', mensagem: '' }, versaoAtual)
}

function garantirEstado() {
  if (!estado) estado = estadoInicial()
  return estado
}

function emitir(parcial) {
  estado = sanitizarEstado({ ...garantirEstado(), ...parcial }, app.getVersion())
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue
    win.webContents.send('orb:atualizacao-evento', estado)
  }
  return estado
}

function garantirOuvintes() {
  if (ouvintesProntos) return
  ouvintesProntos = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.logger = {
    info: (...args) => console.log('[atualizacao]', ...args),
    warn: (...args) => console.warn('[atualizacao]', ...args),
    error: (...args) => console.error('[atualizacao]', ...args),
    debug: () => {},
  }

  if (!app.isPackaged && process.env.ORBULLETS_FORCE_UPDATES === '1') {
    autoUpdater.forceDevUpdateConfig = true
  }

  autoUpdater.on('checking-for-update', () => {
    fase = 'verificar'
    verificacaoEmAndamento = true
    emitir({
      status: 'checking',
      mensagem: 'Procurando atualizações...',
      progresso: null,
      versaoNova: null,
    })
  })

  autoUpdater.on('update-available', (info) => {
    verificacaoEmAndamento = false
    const versaoNova = info?.version ? String(info.version) : null
    if (versaoNova && !aceitarAtualizacao(versaoNova, app.getVersion())) {
      downloadEmAndamento = false
      emitir({
        status: 'not-available',
        versaoNova: null,
        progresso: null,
        mensagem: 'A versão publicada não é mais nova que a atual.',
      })
      return
    }
    fase = 'baixar'
    downloadEmAndamento = true
    emitir({
      status: 'available',
      versaoNova,
      progresso: 0,
      mensagem: versaoNova
        ? `Nova versão ${versaoNova} disponível. O download começou.`
        : 'Nova versão disponível. O download começou.',
    })
  })

  autoUpdater.on('update-not-available', () => {
    verificacaoEmAndamento = false
    downloadEmAndamento = false
    emitir({
      status: 'not-available',
      versaoNova: null,
      progresso: null,
      mensagem: 'O aplicativo já está na versão mais recente.',
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    verificacaoEmAndamento = false
    downloadEmAndamento = true
    fase = 'baixar'
    const percentual = Number(progress?.percent)
    emitir({
      status: 'downloading',
      progresso: Number.isFinite(percentual) ? percentual : 0,
      mensagem: 'Baixando atualização...',
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    verificacaoEmAndamento = false
    downloadEmAndamento = false
    const versaoNova = info?.version
      ? String(info.version)
      : garantirEstado().versaoNova
    emitir({
      status: 'downloaded',
      versaoNova,
      progresso: 100,
      mensagem: versaoNova
        ? `A versão ${versaoNova} está pronta para instalar.`
        : 'A atualização está pronta para instalar.',
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[atualizacao]', err?.message || err)
    verificacaoEmAndamento = false
    downloadEmAndamento = false
    emitir({ ...classificarErroAtualizacao(err, fase), progresso: null })
  })
}

function verificarAtualizacoes() {
  if (!deveVerificar()) {
    estado = estadoInicial()
    emitir(estado)
    return estado
  }

  garantirOuvintes()
  if (verificacaoEmAndamento || downloadEmAndamento) return garantirEstado()
  if (garantirEstado().status === 'downloaded') return estado

  verificacaoEmAndamento = true
  fase = 'verificar'
  emitir({ status: 'checking', mensagem: 'Procurando atualizações...', progresso: null })

  Promise.resolve()
    .then(() => autoUpdater.checkForUpdates())
    .catch((err) => {
      if (!verificacaoEmAndamento && !downloadEmAndamento) return
      console.error('[atualizacao]', err?.message || err)
      verificacaoEmAndamento = false
      downloadEmAndamento = false
      emitir({ ...classificarErroAtualizacao(err, fase), progresso: null })
    })

  return garantirEstado()
}

/** Primeira verificação ao abrir e depois a cada INTERVALO_VERIFICACAO_MS. */
function iniciarVerificacaoPeriodica() {
  verificarAtualizacoes()
  if (intervalo || !deveVerificar()) return
  intervalo = setInterval(verificarAtualizacoes, INTERVALO_VERIFICACAO_MS)
}

function obterEstadoAtualizacao() {
  return garantirEstado()
}

function atualizacaoBaixada() {
  return garantirEstado().status === 'downloaded'
}

/**
 * Fecha o servidor local (grava o banco e faz a última sincronização) e só então
 * reinicia no instalador. Os dados ficam na pasta do usuário, fora da instalação.
 * @param {() => Promise<void>} antesDeInstalar
 */
async function executarInstalacao(antesDeInstalar) {
  if (instalacaoDisparada) return { ok: false, reason: 'already-installing' }
  if (!atualizacaoBaixada()) return { ok: false, reason: 'not-downloaded' }
  instalacaoDisparada = true
  try {
    await antesDeInstalar?.()
  } catch (err) {
    console.error('[atualizacao] falha ao fechar o servidor antes de instalar', err)
  }
  autoUpdater.quitAndInstall(true, true)
  return { ok: true, reason: null }
}

module.exports = {
  verificarAtualizacoes,
  iniciarVerificacaoPeriodica,
  obterEstadoAtualizacao,
  atualizacaoBaixada,
  executarInstalacao,
}
