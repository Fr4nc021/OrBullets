const test = require('node:test')
const assert = require('node:assert/strict')
const {
  aceitarAtualizacao,
  classificarErroAtualizacao,
  sanitizarEstado,
  shouldCheckForUpdates,
  validarConfigPublicacao,
} = require('../electron/atualizacaoPolitica.js')
const pkg = require('../package.json')

test('só aceita versão mais nova', () => {
  assert.equal(aceitarAtualizacao('2.6.1', '2.6.0'), true)
  assert.equal(aceitarAtualizacao('2.10.0', '2.9.9'), true)
  assert.equal(aceitarAtualizacao('2.6.0', '2.6.0'), false)
  assert.equal(aceitarAtualizacao('2.5.9', '2.6.0'), false)
})

test('não verifica em desenvolvimento, a não ser forçado', () => {
  assert.equal(shouldCheckForUpdates({ isPackaged: false }), false)
  assert.equal(shouldCheckForUpdates({ isPackaged: true }), true)
  assert.equal(shouldCheckForUpdates({ isPackaged: false, forceEnv: '1' }), true)
})

test('sem release publicada não é erro', () => {
  const r = classificarErroAtualizacao(new Error('Cannot find latest.yml (404)'))
  assert.equal(r.status, 'not-available')
})

test('sem internet vira mensagem clara', () => {
  const r = classificarErroAtualizacao(new Error('getaddrinfo ENOTFOUND github.com'))
  assert.equal(r.status, 'error')
  assert.match(r.mensagem, /conexão/)
})

test('estado inválido é saneado', () => {
  const e = sanitizarEstado({ status: 'xyz', progresso: 150 }, '2.6.0')
  assert.equal(e.status, 'error')
  assert.equal(e.progresso, 100)
  assert.equal(e.versaoAtual, '2.6.0')
})

test('package.json publica no repositório certo', () => {
  const r = validarConfigPublicacao({ publish: pkg.build.publish })
  assert.deepEqual(r.erros, [])
})

test('tag precisa bater com a versão', () => {
  const ok = validarConfigPublicacao({
    publish: pkg.build.publish,
    tag: `v${pkg.version}`,
    version: pkg.version,
    token: 'x',
    exigirTag: true,
    exigirToken: true,
  })
  assert.equal(ok.ok, true)
  const errado = validarConfigPublicacao({
    publish: pkg.build.publish,
    tag: 'v0.0.1',
    version: pkg.version,
    exigirTag: true,
  })
  assert.equal(errado.ok, false)
})
