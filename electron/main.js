const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const http = require('http')
const { execFile } = require('child_process')
const { pathToFileURL } = require('node:url')

const SPLASH_MIN_MS = 1400

if (process.platform === 'win32') {
  app.setAppUserModelId('com.orbullets.desktop')
}

const serverModPath = path.join(__dirname, '..', 'backend', 'server.js')
/** @type {{ start: Function, stop: Function } | null} */
let serverMod = null

function loadServerModule() {
  if (!serverMod) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    serverMod = require(serverModPath)
  }
  return serverMod
}

const DEFAULT_PORT = 3000

function getConfigPath() {
  return path.join(app.getPath('userData'), 'orbullets-config.json')
}

function readConfig() {
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      return JSON.parse(raw)
    }
  } catch {
    /* ignore */
  }
  return {}
}

function writeConfig(partial) {
  const cur = readConfig()
  const next = { ...cur, ...partial }
  if (next.port == null) next.port = DEFAULT_PORT
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function getLocalIPv4Addresses() {
  const nets = os.networkInterfaces()
  const out = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        out.push({ name, address: net.address })
      }
    }
  }
  return out
}

function getDbPath() {
  return path.join(app.getPath('userData'), 'database.db')
}

function getClubDbPath() {
  return path.join(app.getPath('userData'), 'club-database.db')
}

const { loadEnvFile, applySupabaseDefaults } = require('../backend/loadEnv.js')

function applySupabaseSyncEnvFromUserData() {
  const userData = app.getPath('userData')
  const destEnv = path.join(userData, '.env')
  if (!fs.existsSync(destEnv)) {
    const baked = [
      path.join(__dirname, '..', '.env'),
      process.resourcesPath ? path.join(process.resourcesPath, '.env') : '',
    ]
    for (const src of baked) {
      if (src && fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, destEnv)
        } catch {
          /* ignore */
        }
        break
      }
    }
  }

  const exeDir = path.dirname(app.getPath('exe'))
  const projectEnv = path.join(__dirname, '..', '.env')

  loadEnvFile(path.join(userData, '.env'))
  loadEnvFile(path.join(exeDir, '.env'))
  if (process.resourcesPath) {
    loadEnvFile(path.join(process.resourcesPath, '.env'))
  }
  loadEnvFile(projectEnv)

  try {
    const p = path.join(userData, 'supabase-sync.json')
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (j.url && typeof j.url === 'string' && !process.env.ORB_SUPABASE_SYNC_URL) {
        process.env.ORB_SUPABASE_SYNC_URL = j.url.trim()
      }
      if (j.key && typeof j.key === 'string' && !process.env.ORB_SUPABASE_SYNC_KEY) {
        process.env.ORB_SUPABASE_SYNC_KEY = j.key.trim()
      }
    }
  } catch (e) {
    console.warn('OrBullets: supabase-sync.json ignorado:', e.message)
  }

  applySupabaseDefaults()
}

async function ensureServerRunning() {
  applySupabaseSyncEnvFromUserData()
  const cfg = readConfig()
  if (cfg.mode !== 'server') {
    return { ok: false, reason: 'not_server_mode' }
  }
  const port = Number(cfg.port) || DEFAULT_PORT
  const { start } = loadServerModule()
  try {
    await start({
      dbPath: getDbPath(),
      clubDbPath: getClubDbPath(),
      port,
      onListening: () => {},
      supabaseSync: true,
    })
    return { ok: true, port }
  } catch (e) {
    const msg = e?.message || String(e)
    if (msg.includes('EADDRINUSE') || msg.includes('already running')) {
      return { ok: true, port, already: true }
    }
    throw e
  }
}

async function stopServerIfRunning() {
  const { stop } = loadServerModule()
  await stop()
}

function isDevServerReachable(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 400)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(750, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function loadWindowContent(win) {
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  const distExists = fs.existsSync(distIndex)

  const forceDev = process.env.ORB_ELECTRON_DEV === '1'
  const forceProd = process.env.ORB_ELECTRON_DEV === '0'

  let useDev = forceDev
  if (!useDev && !forceProd && !app.isPackaged) {
    useDev = await isDevServerReachable(devUrl)
  }

  if (useDev) {
    await win.loadURL(devUrl)
    return
  }

  if (distExists || app.isPackaged) {
    await win.loadFile(distIndex)
    return
  }

  console.error(
    'OrBullets: servidor Vite indisponível e dist/ não encontrado. Execute "npm run dev" ou "npm run build".',
  )
  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      '<h2>OrBullets</h2><p>Execute <code>npm run dev</code> (desenvolvimento) ou <code>npm run build</code> seguido de <code>npm start</code>.</p>',
    )}`,
  )
}

function getAppIconPath() {
  const iconPath = path.join(__dirname, 'icon.png')
  return fs.existsSync(iconPath) ? iconPath : undefined
}

function psSingleQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

/** Atalho na área de trabalho do utilizador que instalou o programa. */
function ensureWindowsDesktopShortcut() {
  if (process.platform !== 'win32' || !app.isPackaged) return
  let desktop
  try {
    desktop = app.getPath('desktop')
  } catch {
    return
  }
  const linkPath = path.join(desktop, 'OrBullets.lnk')
  const exe = app.getPath('exe')
  const iconFile = path.join(path.dirname(exe), 'OrBullets.ico')
  const iconLocation = fs.existsSync(iconFile) ? iconFile : `${exe},0`
  const command = [
    '$shell = New-Object -ComObject WScript.Shell',
    `$shortcut = $shell.CreateShortcut(${psSingleQuote(linkPath)})`,
    `$shortcut.TargetPath = ${psSingleQuote(exe)}`,
    `$shortcut.WorkingDirectory = ${psSingleQuote(path.dirname(exe))}`,
    `$shortcut.IconLocation = ${psSingleQuote(iconLocation)}`,
    "$shortcut.Description = 'OrBullets'",
    '$shortcut.Save()',
  ].join('; ')
  execFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { windowsHide: true },
    (err) => {
      if (err) {
        console.warn('OrBullets: atalho da área de trabalho:', err.message)
      }
    },
  )
}

function createSplashWindow(iconPath) {
  const splash = new BrowserWindow({
    width: 720,
    height: 720,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    backgroundColor: '#000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  splash.once('ready-to-show', () => {
    if (!splash.isDestroyed()) splash.show()
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))
  return splash
}

function revealMainAfterSplash(win, splash) {
  const startedAt = Date.now()
  let revealed = false
  let revealTimer = null
  let failSafe = null

  const closeSplash = () => {
    if (splash && !splash.isDestroyed()) splash.close()
  }

  const reveal = () => {
    if (revealed) return
    revealed = true
    clearTimeout(failSafe)
    ipcMain.removeListener('orb:ui-ready', onUiReady)
    const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - startedAt))
    revealTimer = setTimeout(() => {
      if (win && !win.isDestroyed()) {
        win.show()
        win.focus()
      }
      closeSplash()
    }, wait)
  }

  const onUiReady = () => reveal()
  ipcMain.on('orb:ui-ready', onUiReady)
  failSafe = setTimeout(reveal, 20000)

  win.once('closed', () => {
    clearTimeout(failSafe)
    clearTimeout(revealTimer)
    ipcMain.removeListener('orb:ui-ready', onUiReady)
    closeSplash()
  })

  win.webContents.on('did-finish-load', () => {
    const url = win.webContents.getURL()
    if (url.startsWith('data:')) reveal()
  })
  win.webContents.on('did-fail-load', () => reveal())
}

async function createWindow() {
  const iconPath = getAppIconPath()
  const splash = createSplashWindow(iconPath)
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.removeMenu()
  revealMainAfterSplash(win, splash)
  await loadWindowContent(win)

  return win
}

function registerIpc() {
  ipcMain.handle('orb:get-config', () => readConfig())

  ipcMain.handle('orb:set-config', async (_e, partial) => {
    const next = writeConfig(partial)
    if (next.mode === 'server') {
      try {
        await stopServerIfRunning()
      } catch {
        /* ignore */
      }
      await ensureServerRunning()
    } else {
      try {
        await stopServerIfRunning()
      } catch {
        /* ignore */
      }
    }
    return next
  })

  ipcMain.handle('orb:local-ipv4s', () => getLocalIPv4Addresses())

  ipcMain.handle('orb:ensure-server-running', async () => {
    await ensureServerRunning()
    return { ok: true, addresses: getLocalIPv4Addresses() }
  })

  ipcMain.handle('orb:stop-server', async () => {
    await stopServerIfRunning()
    return { ok: true }
  })

  /**
   * Grava o PDF em ficheiro temporário, carrega numa janela e chama
   * webContents.print({ silent: false }) para o diálogo nativo.
   * Com show:false o Chromium costuma não rasterizar o PDF direito na impressão;
   * por isso a janela fica fora do ecrã mas show:true.
   */
  ipcMain.handle('orb:print-pdf-base64', async (_event, base64, options) => {
    if (!base64 || typeof base64 !== 'string') {
      return { ok: false, error: 'invalid_payload' }
    }
    const tmpPath = path.join(
      app.getPath('temp'),
      `orb-print-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`,
    )
    let printWin = null
    try {
      const buf = Buffer.from(base64, 'base64')
      if (buf.length === 0) return { ok: false, error: 'empty_pdf' }
      fs.writeFileSync(tmpPath, buf)

      printWin = new BrowserWindow({
        width: 900,
        height: 1200,
        show: true,
        x: -10000,
        y: -10000,
        skipTaskbar: true,
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
        },
      })

      const fileUrl = pathToFileURL(tmpPath).href
      await printWin.loadURL(fileUrl)
      await new Promise((r) => setTimeout(r, 750))

      await new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: false,
            printBackground: true,
            color: true,
            ...(options?.duplex ? { duplexMode: 'longEdge' } : {}),
          },
          () => {
            resolve()
          },
        )
      })

      return { ok: true }
    } catch (e) {
      const msg = e?.message || String(e)
      return { ok: false, error: msg || 'print_failed' }
    } finally {
      if (printWin && !printWin.isDestroyed()) {
        printWin.destroy()
      }
      try {
        fs.unlinkSync(tmpPath)
      } catch {
        /* ignore */
      }
    }
  })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  ensureWindowsDesktopShortcut()
  registerIpc()
  applySupabaseSyncEnvFromUserData()

  const cfg = readConfig()
  if (cfg.mode === 'server') {
    try {
      await ensureServerRunning()
    } catch (err) {
      console.error('OrBullets: falha ao iniciar servidor local', err)
    }
  }

  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  try {
    await stopServerIfRunning()
  } catch {
    /* ignore */
  }
})
