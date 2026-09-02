/**
 * iwrite – Electron Preload (contextBridge)
 * Exposes a clean, typed window.electronAPI to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window controls ─────────────────────────────────────────────────────────
  minimize:    () => ipcRenderer.send('window:minimize'),
  maximize:    () => ipcRenderer.send('window:maximize'),
  close:       () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  /** Fires whenever the window transitions between maximised / restored */
  onWindowMaximized: (cb) => {
    const handler = (_e, val) => cb(val);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },

  // ── Antigravity Credits ─────────────────────────────────────────────────────
  /**
   * Fetch the current credit balance immediately from the main process.
   * Main will also push an update to all listeners.
   */
  fetchCredits: () => ipcRenderer.invoke('credits:fetch'),

  /**
   * Subscribe to credit balance updates pushed by main (polling + transaction events).
   * Returns an unsubscribe function.
   */
  onCreditsUpdate: (cb) => {
    const handler = (_e, value) => cb(value);
    ipcRenderer.on('credits:update', handler);
    return () => ipcRenderer.removeListener('credits:update', handler);
  },

  /**
   * Notify main that credits were consumed.
   * Main will optimistically deduct `delta` then re-fetch the authoritative value.
   * @param {number} delta - credits consumed (e.g. 5 for a note generation)
   */
  creditsConsumed: (delta = 1) => ipcRenderer.send('credits:consumed', delta),

  // ── Deep links (replaces Capacitor appUrlOpen) ──────────────────────────────
  onDeepLink: (cb) => {
    const handler = (_e, url) => cb(url);
    ipcRenderer.on('app:deeplink', handler);
    return () => ipcRenderer.removeListener('app:deeplink', handler);
  },
});
