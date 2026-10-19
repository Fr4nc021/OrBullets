/**
 * Regras puras da atualização automática (sem Electron), para poderem ser testadas.
 * Mesmo esquema do GestorDesk: releases públicas no GitHub, tag vX.Y.Z.
 */

const STATUS_ATUALIZACAO = new Set([
  'idle',
  'dev',
  'checking',
  'available',
  'downloading',
  'downloaded',
  'not-available',
  'error',
])

const REPO_OWNER = 'Fr4nc021'
const REPO_NAME = 'OrBullets'

function shouldCheckForUpdates({ isPackaged = false, forceEnv = '' } = {}) {
  if (String(forceEnv) === '1') return true
  return Boolean(isPackaged)
}

function compararVersoes(esquerda, direita) {
  const partes = (valor) =>
    String(valor ?? '')
      .split('.')
      .slice(0, 3)
      .map((parte) => {
        const numero = parseInt(parte, 10)
        return Number.isFinite(numero) ? numero : 0
      })

  const a = partes(esquerda)
  const b = partes(direita)
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

function aceitarAtualizacao(candidata, atual) {
  return compararVersoes(candidata, atual) > 0
}

function tagCorrespondeVersao(tag, version) {
  return (
    typeof tag === 'string' &&
    typeof version === 'string' &&
    tag.length > 0 &&
    tag === `v${version}`
  )
}

function classificarErroAtualizacao(err, fase = 'verificar') {
  const message = String(err?.message || err || '')
  const status = Number(err?.statusCode || err?.status || 0)
  const semRelease =
    status === 404 ||
    /\b404\b/.test(message) ||
    /latest\.yml/i.test(message) ||
    /no published versions/i.test(message)

  if (fase === 'verificar' && semRelease) {
    return {
      status: 'not-available',
      mensagem: 'Nenhuma atualização publicada.',
    }
  }

  if (
    status === 401 ||
    status === 403 ||
    /\b(401|403)\b/.test(message) ||
    /unauthorized|forbidden/i.test(message)
  ) {
    return {
      status: 'error',
      mensagem:
        'Não foi possível baixar a atualização. A release precisa estar pública, sem token no aplicativo.',
    }
  }

  if (
    /ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ERR_INTERNET|ERR_NETWORK|getaddrinfo|offline/i.test(
      message,
    )
  ) {
    return {
      status: 'error',
      mensagem:
        'Não foi possível verificar atualizações. Sem conexão ou o GitHub está indisponível.',
    }
  }

  if (fase === 'baixar') {
    return { status: 'error', mensagem: 'O download da atualização falhou.' }
  }

  return { status: 'error', mensagem: 'Não foi possível verificar atualizações.' }
}

function sanitizarEstado(entrada, versaoAtual) {
  const status = STATUS_ATUALIZACAO.has(entrada?.status) ? entrada.status : 'error'
  const progressoNumero = Number(entrada?.progresso)
  const progresso =
    entrada?.progresso != null && Number.isFinite(progressoNumero)
      ? Math.max(0, Math.min(100, Math.round(progressoNumero)))
      : null
  const versaoNova =
    typeof entrada?.versaoNova === 'string' && entrada.versaoNova.trim()
      ? entrada.versaoNova.trim().slice(0, 32)
      : null

  return {
    status,
    versaoAtual: String(versaoAtual || ''),
    versaoNova,
    progresso,
    mensagem: String(entrada?.mensagem || '').slice(0, 240),
  }
}

function validarConfigPublicacao({
  publish,
  tag = '',
  version = '',
  token = '',
  exigirToken = false,
  exigirTag = false,
} = {}) {
  const erros = []
  const config = Array.isArray(publish) ? publish[0] : publish

  if (!config || config.provider !== 'github') {
    erros.push('A publicação precisa usar o provedor github do electron-updater.')
  }
  if (
    config?.owner &&
    config?.repo &&
    (config.owner !== REPO_OWNER || config.repo !== REPO_NAME)
  ) {
    erros.push(
      `O repositório de publicação deve ser ${REPO_OWNER}/${REPO_NAME}, o remote já configurado.`,
    )
  }
  if (config && config.releaseType && config.releaseType !== 'release') {
    erros.push(
      'A release precisa ser publicada como release, para o aplicativo conseguir baixá-la sem token.',
    )
  }

  if (exigirTag && !tag) {
    erros.push(
      'GITHUB_REF_NAME ausente. A publicação só pode ocorrer a partir de uma tag vX.Y.Z.',
    )
  } else if (tag && !tagCorrespondeVersao(tag, version)) {
    erros.push(
      `A tag ${tag} não corresponde à versão v${version} do package.json. Atualize "version" no package.json antes de criar a tag.`,
    )
  }

  if (exigirToken && !String(token || '').trim()) {
    erros.push(
      'GH_TOKEN ausente. No GitHub Actions use secrets.GITHUB_TOKEN, sem gravar o token no projeto.',
    )
  }

  return { ok: erros.length === 0, erros }
}

module.exports = {
  STATUS_ATUALIZACAO,
  shouldCheckForUpdates,
  compararVersoes,
  aceitarAtualizacao,
  tagCorrespondeVersao,
  classificarErroAtualizacao,
  sanitizarEstado,
  validarConfigPublicacao,
}
