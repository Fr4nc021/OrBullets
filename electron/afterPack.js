const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Grava o logo no executável. O instalador não faz isso quando
 * signAndEditExecutable está desligado.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const icon = path.join(__dirname, '..', 'build', 'icon.ico')
  const rcedit = path.join(
    __dirname,
    '..',
    'node_modules',
    'electron-winstaller',
    'vendor',
    'rcedit.exe',
  )

  if (!fs.existsSync(exe) || !fs.existsSync(icon) || !fs.existsSync(rcedit)) {
    const missing = [exe, icon, rcedit].filter((p) => !fs.existsSync(p)).join(', ')
    throw new Error(`Não foi possível gravar o logo no executável do OrBullets. Arquivo ausente: ${missing}`)
  }

  execFileSync(rcedit, [exe, '--set-icon', icon], { stdio: 'inherit' })
}
