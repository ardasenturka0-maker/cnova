const { app, BrowserWindow, ipcMain, net, protocol, safeStorage, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { MeshTransport } = require("./mesh-transport.cjs");

protocol.registerSchemesAsPrivileged([{ scheme: "clinicnova", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const allowedAssets = new Set(["index.html", "app.css", "app.js", "mesh-sync.js", "runtime-config.js"]);
let mainWindow;
let storePath;
let encryptedStore = {};
let meshTransport;

function rendererAllowed(event) {
  try { return new URL(event.senderFrame.url).origin === "clinicnova://app"; } catch { return false; }
}

function validStorageKey(key) {
  return typeof key === "string" && /^clinicnova\.[A-Za-z0-9._-]{1,80}$/.test(key);
}

function persistStore() {
  const temporary = `${storePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(encryptedStore), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, storePath);
}

function readEncryptedValue(key) {
  if (!validStorageKey(key) || typeof encryptedStore[key] !== "string") return null;
  try { return safeStorage.decryptString(Buffer.from(encryptedStore[key], "base64")); } catch { return null; }
}

async function readResponseLimited(response, maximumBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maximumBytes) throw new Error("Sunucu eşitleme yanıtı güvenli boyut sınırını aştı.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("Sunucu eşitleme yanıtı güvenli boyut sınırını aştı.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function installIpcHandlers() {
  ipcMain.on("clinicnova:storage-get", (event, key) => {
    event.returnValue = rendererAllowed(event) ? readEncryptedValue(key) : null;
  });
  ipcMain.on("clinicnova:storage-set", (event, key, value) => {
    event.returnValue = false;
    if (!rendererAllowed(event) || !validStorageKey(key) || typeof value !== "string" || Buffer.byteLength(value) > 64 * 1024 * 1024) return;
    if (!safeStorage.isEncryptionAvailable()) return;
    encryptedStore[key] = safeStorage.encryptString(value).toString("base64");
    persistStore();
    event.returnValue = true;
  });
  ipcMain.on("clinicnova:storage-remove", (event, key) => {
    event.returnValue = false;
    if (!rendererAllowed(event) || !validStorageKey(key)) return;
    delete encryptedStore[key];
    persistStore();
    event.returnValue = true;
  });
  ipcMain.on("clinicnova:mesh-get-config", event => {
    event.returnValue = rendererAllowed(event) ? readEncryptedValue("clinicnova.meshNativeConfig") : null;
  });
  ipcMain.on("clinicnova:mesh-get-envelope", event => {
    event.returnValue = rendererAllowed(event) ? readEncryptedValue("clinicnova.meshEnvelope") : null;
  });
  ipcMain.on("clinicnova:mesh-configure", (event, json) => {
    event.returnValue = false;
    if (!rendererAllowed(event) || typeof json !== "string" || Buffer.byteLength(json) > 8192 || !safeStorage.isEncryptionAvailable()) return;
    try {
      const config = JSON.parse(json); meshTransport.configure(config);
      encryptedStore["clinicnova.meshNativeConfig"] = safeStorage.encryptString(json).toString("base64"); persistStore(); event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("clinicnova:mesh-publish", (event, envelope) => {
    event.returnValue = false;
    if (!rendererAllowed(event) || typeof envelope !== "string" || Buffer.byteLength(envelope) > 64 * 1024 * 1024 || !safeStorage.isEncryptionAvailable()) return;
    encryptedStore["clinicnova.meshEnvelope"] = safeStorage.encryptString(envelope).toString("base64"); persistStore(); event.returnValue = true;
  });
  ipcMain.on("clinicnova:mesh-sync-now", event => { if (rendererAllowed(event)) meshTransport.syncNow(); });
  ipcMain.on("clinicnova:mesh-disable", event => {
    event.returnValue = false; if (!rendererAllowed(event)) return; meshTransport.stop(); meshTransport.config = null;
    delete encryptedStore["clinicnova.meshNativeConfig"]; delete encryptedStore["clinicnova.meshEnvelope"]; persistStore(); event.returnValue = true;
  });
  ipcMain.on("clinicnova:sync", async (event, serverUrl, batchJson) => {
    if (!rendererAllowed(event)) return;
    let status = 0;
    let responseText = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const base = new URL(String(serverUrl));
      if (base.protocol !== "https:" || !base.hostname || base.username || base.password || (base.port && base.port !== "443") || !["", "/"].includes(base.pathname) || base.search || base.hash) throw new Error("HTTPS sunucu adresi gerekli.");
      if (typeof batchJson !== "string" || Buffer.byteLength(batchJson) > 4 * 1024 * 1024) throw new Error("Senkronizasyon paketi çok büyük.");
      const parsed = JSON.parse(batchJson);
      if (!parsed || !Array.isArray(parsed.operations) || parsed.operations.length > 50) throw new Error("Senkronizasyon paketi geçersiz.");
      const endpoint = new URL("/api/mobile/sync", base.origin);
      const response = await event.sender.session.fetch(endpoint.href, {
        method: "POST",
        signal: controller.signal,
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json", "User-Agent": `ClinicNovaDesktop/${app.getVersion()}` },
        body: batchJson
      });
      status = response.status;
      responseText = await readResponseLimited(response, 64 * 1024 * 1024);
    } catch (error) {
      responseText = JSON.stringify({ error: error?.name === "AbortError" ? "Sunucu eşitleme isteği zaman aşımına uğradı." : error instanceof Error ? error.message : "Sunucuya ulaşılamadı." });
    } finally {
      clearTimeout(timeout);
    }
    if (!event.sender.isDestroyed()) event.sender.send("clinicnova:sync-result", status, responseText);
  });
}

function createWindow() {
  let allowedServerOrigin = "";
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: "#f8fafc",
    title: "ClinicNova",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { if (new URL(url).protocol === "https:") void shell.openExternal(url); } catch { /* Ignore invalid external URL. */ }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      const target = new URL(targetUrl);
      const current = new URL(mainWindow.webContents.getURL());
      if (target.protocol === "clinicnova:" && target.hostname === "sync") {
        event.preventDefault();
        void mainWindow.loadURL("clinicnova://app/index.html?sync=1");
        return;
      }
      if (target.origin === "clinicnova://app") return;
      if (target.protocol === "https:" && current.origin === "clinicnova://app") {
        allowedServerOrigin = target.origin;
        return;
      }
      if (target.protocol === "https:" && target.origin === allowedServerOrigin) return;
    } catch { /* Block malformed navigation. */ }
    event.preventDefault();
  });
  mainWindow.webContents.on("did-fail-load", (_event, _code, _description, validatedUrl, isMainFrame) => {
    if (isMainFrame && validatedUrl.startsWith("https:")) void mainWindow.loadURL("clinicnova://app/index.html?offline=1");
  });
  void mainWindow.loadURL("clinicnova://app/index.html");
}

app.whenReady().then(async () => {
  storePath = path.join(app.getPath("userData"), "clinicnova-local-store.json");
  try { encryptedStore = JSON.parse(fs.readFileSync(storePath, "utf8")); } catch { encryptedStore = {}; }
  const assets = app.isPackaged ? path.join(__dirname, "mobile") : path.join(__dirname, "build");
  protocol.handle("clinicnova", (request) => {
    const url = new URL(request.url);
    const asset = decodeURIComponent(url.pathname.replace(/^\//, "") || "index.html");
    if (url.hostname !== "app" || !allowedAssets.has(asset)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(path.join(assets, asset)).href);
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(webContents.getURL().startsWith("clinicnova://app/") && permission === "media");
  });
  installIpcHandlers();
  meshTransport = new MeshTransport({
    getEnvelope: () => { try { return JSON.parse(readEncryptedValue("clinicnova.meshEnvelope")); } catch { return null; } },
    onEnvelope: (envelope, peerName) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clinicnova:mesh-envelope", JSON.stringify(envelope), peerName); },
    onStatus: (status, peerName) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clinicnova:mesh-status", status, peerName || ""); }
  });
  try { const config = JSON.parse(readEncryptedValue("clinicnova.meshNativeConfig")); if (config) meshTransport.configure(config); } catch { /* No local mesh configured. */ }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => meshTransport?.stop());
