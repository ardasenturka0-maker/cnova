const { app, BrowserWindow, ipcMain, net, Notification, protocol, safeStorage, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { MAX_ENVELOPE, MeshTransport } = require("./mesh-transport.cjs");
const {
  classifyMainFrameRedirect,
  hashSecret,
  isLocalAppDocument,
  normalizeDashboardPath,
  normalizeProductUrl,
  normalizeServerOrigin,
  parseSyncBatch,
  sanitizeEncryptedStore,
  validStorageKey
} = require("./native-policy.cjs");

protocol.registerSchemesAsPrivileged([{
  scheme: "clinicnova",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false }
}]);
app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.removeSwitch("remote-debugging-port");
app.commandLine.removeSwitch("remote-debugging-pipe");
app.enableSandbox();

const allowedAssets = new Set(["index.html", "app.css", "app.js", "mesh-sync.js", "runtime-config.js"]);
const recentNotificationTags = new Map();
const singleInstance = app.requestSingleInstanceLock();
let mainWindow = null;
let storePath = "";
let encryptedStore = Object.create(null);
let meshTransport = null;
let allowedServerOrigin = "";
let pendingServerNavigation = "";

function rendererAllowed(event) {
  return Boolean(event.senderFrame && event.senderFrame === event.sender.mainFrame && isLocalAppDocument(event.senderFrame.url));
}

function atomicWrite(filePath, text) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, "w", 0o600);
    fs.writeFileSync(descriptor, text, { encoding: "utf8" });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor); descriptor = undefined;
    fs.renameSync(temporary, filePath);
    try { fs.chmodSync(filePath, 0o600); } catch { /* Windows ACLs are managed by the user profile. */ }
  } finally {
    if (descriptor !== undefined) try { fs.closeSync(descriptor); } catch { /* Already closed. */ }
    try { fs.unlinkSync(temporary); } catch { /* Atomic rename already consumed the temporary file. */ }
  }
}

function persistStore(nextStore = encryptedStore) {
  atomicWrite(storePath, JSON.stringify(nextStore));
}

function readEncryptedValue(key) {
  if (!validStorageKey(key) || typeof encryptedStore[key] !== "string") return null;
  try { return safeStorage.decryptString(Buffer.from(encryptedStore[key], "base64")); } catch { return null; }
}

function readStoredJson(key) {
  try { return JSON.parse(readEncryptedValue(key)); } catch { return null; }
}

function configuredServerOrigin(value) {
  const requested = normalizeServerOrigin(value);
  const storedValue = readStoredJson("clinicnova.serverUrl");
  const stored = typeof storedValue === "string" ? normalizeServerOrigin(storedValue) : "";
  if (!stored || stored !== requested) throw new Error("Önce kayıtlı ClinicNova sunucusuna bağlanın.");
  return requested;
}

function sendToRenderer(event, channel, ...args) {
  if (!event.sender.isDestroyed()) event.sender.send(channel, ...args);
}

async function readResponseLimited(response, maximumBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new Error("Sunucu yanıtı güvenli boyut sınırını aştı.");
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
      throw new Error("Sunucu yanıtı güvenli boyut sınırını aştı.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

async function postToConfiguredServer(event, { serverUrl, endpoint, body, maximumBytes, timeoutMs }) {
  const origin = configuredServerOrigin(serverUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await event.sender.session.fetch(new URL(endpoint, origin).href, {
      method: "POST",
      signal: controller.signal,
      credentials: "include",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "User-Agent": `ClinicNovaDesktop/${app.getVersion()}`
      },
      body
    });
    return { status: response.status, responseText: await readResponseLimited(response, maximumBytes) };
  } finally {
    clearTimeout(timeout);
  }
}

function navigateToConfiguredServer(serverUrl, targetPath) {
  const origin = configuredServerOrigin(serverUrl);
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  allowedServerOrigin = origin;
  pendingServerNavigation = new URL(targetPath, origin).href;
  void mainWindow.loadURL(pendingServerNavigation).catch(() => {});
  return true;
}

function showLocalNotification(title, body, tag) {
  if (typeof Notification.isSupported === "function" && !Notification.isSupported()) return false;
  if (typeof title !== "string" || typeof body !== "string" || typeof tag !== "string") return false;
  if (Buffer.byteLength(title) > 320 || Buffer.byteLength(body) > 4096 || !/^[A-Za-z0-9._:-]{1,160}$/.test(tag)) return false;
  const now = Date.now();
  if (now - Number(recentNotificationTags.get(tag) || 0) < 60_000) return true;
  for (const [existingTag, shownAt] of recentNotificationTags) if (now - shownAt > 24 * 60 * 60_000) recentNotificationTags.delete(existingTag);
  recentNotificationTags.set(tag, now);
  try {
    const notification = new Notification({ title: title.slice(0, 80), body: body.slice(0, 240), silent: false });
    notification.on("click", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
    });
    notification.show();
    return true;
  } catch { return false; }
}

function installIpcHandlers() {
  ipcMain.on("clinicnova:storage-get", (event, key) => {
    event.returnValue = rendererAllowed(event) ? readEncryptedValue(key) : null;
  });
  ipcMain.on("clinicnova:storage-set", (event, key, value) => {
    event.returnValue = false;
    const maximumBytes = key === "clinicnova.meshEnvelope" ? MAX_ENVELOPE : 64 * 1024 * 1024;
    if (!rendererAllowed(event) || !validStorageKey(key) || typeof value !== "string" || Buffer.byteLength(value) > maximumBytes) return;
    if (!safeStorage.isEncryptionAvailable()) return;
    try {
      const nextStore = { ...encryptedStore, [key]: safeStorage.encryptString(value).toString("base64") };
      persistStore(nextStore); encryptedStore = nextStore; event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("clinicnova:storage-remove", (event, key) => {
    event.returnValue = false;
    if (!rendererAllowed(event) || !validStorageKey(key)) return;
    try {
      const nextStore = { ...encryptedStore }; delete nextStore[key];
      persistStore(nextStore); encryptedStore = nextStore; event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("clinicnova:hash-secret", (event, secret, salt, iterations) => {
    event.returnValue = rendererAllowed(event) ? hashSecret(secret, salt, iterations) : "";
  });
  ipcMain.on("clinicnova:request-notification-permission", event => {
    event.returnValue = rendererAllowed(event) && (typeof Notification.isSupported !== "function" || Notification.isSupported());
  });
  ipcMain.on("clinicnova:show-local-notification", (event, title, body, tag) => {
    event.returnValue = rendererAllowed(event) && showLocalNotification(title, body, tag);
  });
  ipcMain.on("clinicnova:connect", (event, serverUrl) => {
    event.returnValue = false;
    if (!rendererAllowed(event)) return;
    try { event.returnValue = navigateToConfiguredServer(serverUrl, "/login?next=%2Fmobile-connect&mobile=desktop"); } catch { event.returnValue = false; }
  });
  ipcMain.on("clinicnova:open-portal", (event, serverUrl, targetPath) => {
    event.returnValue = false;
    if (!rendererAllowed(event)) return;
    try { event.returnValue = navigateToConfiguredServer(serverUrl, normalizeDashboardPath(targetPath)); } catch { event.returnValue = false; }
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
    const previousConfig = meshTransport.config ? { ...meshTransport.config, secret: meshTransport.config.secret.toString("base64") } : null;
    try {
      const config = JSON.parse(json); meshTransport.configure(config);
      const nextStore = { ...encryptedStore, "clinicnova.meshNativeConfig": safeStorage.encryptString(json).toString("base64") };
      persistStore(nextStore); encryptedStore = nextStore; event.returnValue = true;
    } catch {
      try { if (previousConfig) meshTransport.configure(previousConfig); else { meshTransport.stop(); meshTransport.config = null; } } catch { meshTransport.stop(); meshTransport.config = null; }
      event.returnValue = false;
    }
  });
  ipcMain.on("clinicnova:mesh-publish", (event, envelope) => {
    event.returnValue = false;
    if (!rendererAllowed(event) || typeof envelope !== "string" || Buffer.byteLength(envelope) > MAX_ENVELOPE || !safeStorage.isEncryptionAvailable()) return;
    try {
      const parsed = JSON.parse(envelope);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      const nextStore = { ...encryptedStore, "clinicnova.meshEnvelope": safeStorage.encryptString(envelope).toString("base64") };
      persistStore(nextStore); encryptedStore = nextStore; event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("clinicnova:mesh-sync-now", event => { if (rendererAllowed(event)) meshTransport.syncNow(); });
  ipcMain.on("clinicnova:mesh-disable", event => {
    event.returnValue = false;
    if (!rendererAllowed(event)) return;
    try {
      const nextStore = { ...encryptedStore }; delete nextStore["clinicnova.meshNativeConfig"]; delete nextStore["clinicnova.meshEnvelope"];
      persistStore(nextStore); encryptedStore = nextStore; meshTransport.stop(); meshTransport.config = null; event.returnValue = true;
    } catch { event.returnValue = false; }
  });
  ipcMain.on("clinicnova:sync", async (event, serverUrl, batchJson) => {
    if (!rendererAllowed(event)) return;
    let status = 0;
    let responseText = "";
    try {
      parseSyncBatch(batchJson);
      ({ status, responseText } = await postToConfiguredServer(event, {
        serverUrl, endpoint: "/api/mobile/sync", body: batchJson, maximumBytes: 64 * 1024 * 1024, timeoutMs: 45_000
      }));
    } catch (error) {
      responseText = JSON.stringify({ error: error?.name === "AbortError" ? "Sunucu eşitleme isteği zaman aşımına uğradı." : error instanceof Error ? error.message : "Sunucuya ulaşılamadı." });
    }
    sendToRenderer(event, "clinicnova:sync-result", status, responseText);
  });
  ipcMain.on("clinicnova:product-search", async (event, serverUrl, productUrl, itemId) => {
    if (!rendererAllowed(event)) return;
    let status = 0;
    let responseText = "";
    const safeItemId = typeof itemId === "string" && Buffer.byteLength(itemId) <= 160 ? itemId : "";
    try {
      const normalizedProductUrl = normalizeProductUrl(productUrl);
      ({ status, responseText } = await postToConfiguredServer(event, {
        serverUrl,
        endpoint: "/api/mobile/product-search",
        body: JSON.stringify({ productUrl: normalizedProductUrl }),
        maximumBytes: 2 * 1024 * 1024,
        timeoutMs: 35_000
      }));
    } catch (error) {
      responseText = JSON.stringify({ error: error?.name === "AbortError" ? "İnternet fiyatı isteği zaman aşımına uğradı." : error instanceof Error ? error.message : "İnternet fiyatları alınamadı." });
    }
    sendToRenderer(event, "clinicnova:product-search-result", status, responseText, safeItemId);
  });
}

function openExternalHttps(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 8192) return;
  try {
    const target = new URL(value);
    if (target.protocol === "https:" && !target.username && !target.password) void shell.openExternal(target.href).catch(() => {});
  } catch { /* Ignore invalid external links. */ }
}

function returnToLocalApp(window, query) {
  pendingServerNavigation = "";
  allowedServerOrigin = "";
  setImmediate(() => {
    if (!window.isDestroyed()) void window.loadURL(`clinicnova://app/index.html?${query}`).catch(() => {});
  });
}

function createWindow() {
  allowedServerOrigin = "";
  pendingServerNavigation = "";
  const window = new BrowserWindow({
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
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: !app.isPackaged,
      navigateOnDragDrop: false,
      safeDialogs: true,
      safeDialogsMessage: "Bu sayfa ek iletişim kutuları açmayı denedi."
    }
  });
  mainWindow = window;
  window.once("ready-to-show", () => { if (!window.isDestroyed()) window.show(); });
  window.on("closed", () => { if (mainWindow === window) mainWindow = null; });
  window.webContents.on("will-attach-webview", event => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => { openExternalHttps(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      const target = new URL(targetUrl);
      const current = new URL(window.webContents.getURL());
      const decision = classifyMainFrameRedirect(target.href, allowedServerOrigin, current.href, Boolean(pendingServerNavigation));
      if (decision === "local-sync") {
        event.preventDefault(); returnToLocalApp(window, "sync=1");
        return;
      }
      if (isLocalAppDocument(target.href) && isLocalAppDocument(current.href)) return;
      if (decision === "allow-server") return;
      if (target.protocol === "https:") { event.preventDefault(); openExternalHttps(target.href); return; }
    } catch { /* Block malformed navigation. */ }
    event.preventDefault();
  });
  window.webContents.on("will-redirect", (event, legacyTargetUrl, _legacyIsInPlace, legacyIsMainFrame) => {
    if ((event.isMainFrame ?? legacyIsMainFrame) !== true) return;
    const decision = classifyMainFrameRedirect(
      event.url || legacyTargetUrl,
      allowedServerOrigin,
      window.webContents.getURL(),
      Boolean(pendingServerNavigation)
    );
    if (decision === "allow-server") return;
    event.preventDefault();
    if (decision === "local-sync") {
      returnToLocalApp(window, "sync=1");
      return;
    }
    returnToLocalApp(window, "offline=1");
  });
  window.webContents.on("did-navigate", (_event, navigatedUrl) => {
    try { if (new URL(navigatedUrl).origin === allowedServerOrigin) pendingServerNavigation = ""; } catch { /* Ignore malformed completion URLs. */ }
  });
  window.webContents.on("did-fail-load", (_event, _code, _description, validatedUrl, isMainFrame) => {
    if (isMainFrame && validatedUrl.startsWith("https:")) {
      returnToLocalApp(window, "offline=1");
    }
  });
  void window.loadURL("clinicnova://app/index.html").catch(error => {
    console.error("ClinicNova yerel arayüzü yüklenemedi:", error);
  });
}

async function initialize() {
  if (process.platform === "win32") app.setAppUserModelId("app.clinicnova.desktop");
  storePath = path.join(app.getPath("userData"), "clinicnova-local-store.json");
  try { encryptedStore = sanitizeEncryptedStore(JSON.parse(fs.readFileSync(storePath, "utf8"))); } catch { encryptedStore = Object.create(null); }
  await Promise.allSettled([
    session.defaultSession.clearCache(),
    session.defaultSession.clearStorageData({ storages: ["serviceworkers", "cachestorage", "shadercache"] })
  ]);
  const assets = app.isPackaged ? path.join(__dirname, "mobile") : path.join(__dirname, "build");
  protocol.handle("clinicnova", request => {
    try {
      const url = new URL(request.url);
      const asset = decodeURIComponent(url.pathname.replace(/^\//, "") || "index.html");
      if (!["GET", "HEAD"].includes(request.method) || url.hostname !== "app" || !allowedAssets.has(asset)) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(path.join(assets, asset)).href, { method: request.method });
    } catch { return new Response("Bad request", { status: 400 }); }
  });
  const permissionAllowed = (webContents, permission, requestingUrl, details = {}) => {
    if (!webContents || details.isMainFrame !== true) return false;
    if (permission === "notifications") return isLocalAppDocument(webContents.getURL()) && isLocalAppDocument(requestingUrl || webContents.getURL());
    if (permission !== "media" || !allowedServerOrigin) return false;
    const requestedMedia = details.mediaTypes || (details.mediaType ? [details.mediaType] : []);
    if (requestedMedia.length === 0 || requestedMedia.some(type => type !== "video")) return false;
    try {
      return new URL(webContents.getURL()).origin === allowedServerOrigin && new URL(requestingUrl).origin === allowedServerOrigin;
    } catch { return false; }
  };
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => callback(permissionAllowed(webContents, permission, details.requestingUrl, details)));
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => permissionAllowed(webContents, permission, details.requestingUrl || requestingOrigin, details));
  installIpcHandlers();
  meshTransport = new MeshTransport({
    getEnvelope: () => { const value = readStoredJson("clinicnova.meshEnvelope"); return value && typeof value === "object" && !Array.isArray(value) ? value : null; },
    onEnvelope: (envelope, peerName) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clinicnova:mesh-envelope", JSON.stringify(envelope), peerName); },
    onStatus: (status, peerName) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("clinicnova:mesh-status", status, peerName || ""); }
  });
  try { const config = readStoredJson("clinicnova.meshNativeConfig"); if (config) meshTransport.configure(config); } catch { meshTransport.stop(); meshTransport.config = null; }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (app.isReady() && meshTransport) createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
  });
  void app.whenReady().then(initialize).catch(error => { console.error("ClinicNova masaüstü başlatılamadı:", error); app.quit(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("before-quit", () => meshTransport?.stop());
}
