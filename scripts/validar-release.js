/**
 * Confere, antes de publicar, se a tag bate com a versão do package.json
 * e se a publicação aponta para o repositório certo.
 * Uso no GitHub Actions (GITHUB_REF_NAME e GH_TOKEN vêm do workflow).
 */
const { validarConfigPublicacao } = require('../electron/atualizacaoPolitica.js')

function validarReleaseAtual() {
  const pkg = require('../package.json')
  return validarConfigPublicacao({
    publish: pkg.build?.publish,
    tag: process.env.GITHUB_REF_NAME || '',
    version: pkg.version,
    token: process.env.GH_TOKEN || '',
    exigirToken: true,
    exigirTag: true,
  })
}

if (require.main === module) {
  const resultado = validarReleaseAtual()
  if (!resultado.ok) {
    for (const erro of resultado.erros) console.error(`[release] ${erro}`)
    process.exit(1)
  }
  console.log('[release] Tag, repositório e token conferidos.')
}

module.exports = { validarReleaseAtual }
