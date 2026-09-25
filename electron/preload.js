const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('orbDesktop', {
  isElectron: true,
  getConfig: () => ipcRenderer.invoke('orb:get-config'),
  setConfig: (partial) => ipcRenderer.invoke('orb:set-config', partial),
  getLocalIPv4s: () => ipcRenderer.invoke('orb:local-ipv4s'),
  ensureServerRunning: () => ipcRenderer.invoke('orb:ensure-server-running'),
  stopServerIfRunning: () => ipcRenderer.invoke('orb:stop-server'),
  /**
   * Abre o diálogo de impressão do sistema com o PDF.
   * `options.duplex` pede frente e verso (borda longa).
   */
  printPdfFromBase64: (base64, options) =>
    ipcRenderer.invoke('orb:print-pdf-base64', base64, options),
  /** A interface já pode ser mostrada; fecha a tela de abertura. */
  notifyUiReady: () => ipcRenderer.send('orb:ui-ready'),
})
