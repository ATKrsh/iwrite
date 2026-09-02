/**
 * iwrite – Electron Main Process
 * Native Windows desktop app with:
 *   • Frameless custom-chrome window
 *   • System tray
 *   • Antigravity credits: 60 s polling + instant push on AI transactions
 *   • Deep-link IPC replacing Capacitor
 */

const {
  app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, shell
} = require('electron');
const path  = require('path');
const zlib  = require('zlib');
const fs    = require('fs');

function findLedgerPath() {
  let currentDir = __dirname;
  if (currentDir.includes('app.asar')) {
    currentDir = path.dirname(app.getAppPath());
  }
  for (let i = 0; i < 5; i++) {
    const testPath = path.join(currentDir, 'credits_ledger.json');
    if (fs.existsSync(testPath)) {
      return testPath;
    }
    const testSubPath = path.join(currentDir, 'iwrite', 'credits_ledger.json');
    if (fs.existsSync(testSubPath)) {
      return testSubPath;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return path.join(__dirname, '..', 'credits_ledger.json');
}

const LEDGER_PATH = findLedgerPath();

let win  = null;
let tray = null;
let loadURL;
let creditsTimer = null;

// ── Configurable via .env.local ───────────────────────────────────────────────
const CREDITS_API  = process.env.ANTIGRAVITY_CREDITS_API  ?? null;
const CREDITS_KEY  = process.env.ANTIGRAVITY_API_KEY      ?? null;
const POLL_MS      = 60_000;

// ── Mock baseline (used when no real API is configured) ───────────────────────
let mockCredits = 1250;

// ─────────────────────────────────────────────────────────────────────────────
// Credits subsystem
// ─────────────────────────────────────────────────────────────────────────────

async function doFetchCredits() {
  if (CREDITS_API) {
    try {
      const headers = CREDITS_KEY ? { Authorization: `Bearer ${CREDITS_KEY}` } : {};
      const res = await fetch(CREDITS_API, { headers });
      if (res.ok) {
        const data = await res.json();
        return Number(data.remaining ?? data.credits ?? data.balance ?? mockCredits);
      }
    } catch (err) {
      console.warn('[iwrite:credits] fetch failed –', err.message);
    }
  }

  // Fall back to local ledger file if present
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      const content = fs.readFileSync(LEDGER_PATH, 'utf8');
      const data = JSON.parse(content);
      if (data && typeof data.credits === 'number') {
        mockCredits = data.credits;
      }
    }
  } catch (err) {
    console.warn('[iwrite:credits] failed to read local ledger –', err.message);
  }
  return mockCredits;
}

function pushCreditsToRenderer(value) {
  mockCredits = value;
  if (win && !win.isDestroyed()) {
    win.webContents.send('credits:update', value);
  }
  if (tray) {
    tray.setToolTip(`iwrite  ·  ${value.toLocaleString()} credits remaining`);
  }
}

async function refreshCredits() {
  const val = await doFetchCredits();
  pushCreditsToRenderer(val);
}

// Write back to the ledger on consumption to persist state
function writeLedger(value, action = "Transaction") {
  try {
    const data = {
      credits: value,
      last_updated: new Date().toISOString(),
      transactions: [
        {
          id: `tx_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: action,
          delta: value - mockCredits,
          balance: value
        }
      ]
    };
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[iwrite:credits] failed to write ledger –', err.message);
  }
}

function startCreditsPolling() {
  refreshCredits();                             // immediate on startup
  creditsTimer = setInterval(refreshCredits, POLL_MS);

  // Watch ledger file for instant auto-refresh
  try {
    fs.watch(LEDGER_PATH, (eventType) => {
      if (eventType === 'change') {
        // Slight debounce or delay to ensure file write is complete
        setTimeout(refreshCredits, 100);
      }
    });
  } catch (err) {
    console.warn('[iwrite:credits] failed to watch ledger –', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tray icon – generated in-process (solid #0A84FF 16×16 PNG)
// ─────────────────────────────────────────────────────────────────────────────

function buildBluePng(size = 16) {
  // CRC32 table
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    T[n] = c;
  }
  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (const b of buf) c = T[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const mkChunk = (type, data) => {
    const name   = Buffer.from(type, 'ascii');
    const len    = Buffer.allocUnsafe(4);  len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.allocUnsafe(4);  crcBuf.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
    return Buffer.concat([len, name, data, crcBuf]);
  };

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // RGB, no interlace

  // Raw scanlines: filter-byte=0 then size × RGB(10,132,255)
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) { row[1+x*3]=10; row[2+x*3]=132; row[3+x*3]=255; }
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));

  return Buffer.concat([sig, mkChunk('IHDR', ihdr), mkChunk('IDAT', idat), mkChunk('IEND', Buffer.alloc(0))]);
}

function createTray() {
  try {
    const img  = nativeImage.createFromBuffer(buildBluePng(16));
    tray       = new Tray(img);
    const menu = Menu.buildFromTemplate([
      { label: 'Open iwrite',        click: () => { win?.show(); win?.focus(); } },
      { type: 'separator' },
      { label: 'Refresh Credits',    click: refreshCredits },
      { type: 'separator' },
      { label: 'Quit',               click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip(`iwrite  ·  ${mockCredits.toLocaleString()} credits remaining`);
    tray.on('double-click', () => { win?.show(); win?.focus(); });
  } catch (err) {
    console.warn('[iwrite:tray]', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers
// ─────────────────────────────────────────────────────────────────────────────

function registerIpc() {
  // Window controls
  ipcMain.on('window:minimize',    () => win?.minimize());
  ipcMain.on('window:maximize',    () => win?.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on('window:close',       () => win?.close());
  ipcMain.handle('window:isMaximized', () => win?.isMaximized() ?? false);

  // Credits – on-demand fetch (renderer can call after any AI action)
  ipcMain.handle('credits:fetch',  async () => {
    const val = await doFetchCredits();
    pushCreditsToRenderer(val);
    return val;
  });

  // Record a credit-consuming event (no body needed; main re-fetches & pushes)
  ipcMain.on('credits:consumed', async (_event, delta) => {
    if (!CREDITS_API && typeof delta === 'number') {
      const newCredits = Math.max(0, mockCredits - delta);
      writeLedger(newCredits, "AI Generation");
      pushCreditsToRenderer(newCredits);
    }
    // Then do a real fetch to get authoritative value
    await refreshCredits();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  const { default: serve } = await import('electron-serve');
  loadURL = serve({ directory: path.join(__dirname, 'out') });
  await app.whenReady();
  registerIpc();
  createWindow();
  createTray();
  startCreditsPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width:     1300,
    height:    860,
    minWidth:  900,
    minHeight: 600,
    frame:     true,
    backgroundColor: '#000000',
    show:      true,
    webPreferences: {
      preload:           path.join(__dirname, 'preload.js'),
      contextIsolation:  true,
      nodeIntegration:   false,
      sandbox:           false,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.on('maximize',   () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));

  // Minimise to tray instead of closing when user hits X
  win.on('close', (e) => {
    if (tray && !app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    loadURL(win);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────

app.on('before-quit', () => { app.isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (creditsTimer) clearInterval(creditsTimer);
});

init().catch(console.error);
