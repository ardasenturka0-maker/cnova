const { contextBridge, ipcRenderer } = require("electron");

if (
  window.location.protocol === "clinicnova:" && window.location.hostname === "app" &&
  ["", "/", "/index.html"].includes(window.location.pathname)
) {
  const listeners = new Set();
  const productSearchListeners = new Set();
  const meshListeners = new Set();
  const meshStatusListeners = new Set();
  const addListener = (collection, listener) => {
    if (typeof listener !== "function" || collection.size >= 16) return false;
    collection.add(listener); return true;
  };
  const notify = (collection, ...args) => {
    for (const listener of collection) try { listener(...args); } catch { /* Keep other native listeners alive. */ }
  };
  ipcRenderer.on("clinicnova:sync-result", (_event, status, responseText) => {
    notify(listeners, status, responseText);
  });
  ipcRenderer.on("clinicnova:product-search-result", (_event, status, responseText, itemId) => notify(productSearchListeners, status, responseText, itemId));
  ipcRenderer.on("clinicnova:mesh-envelope", (_event, envelope, peerName) => notify(meshListeners, envelope, peerName));
  ipcRenderer.on("clinicnova:mesh-status", (_event, status, peerName) => notify(meshStatusListeners, status, peerName));
  contextBridge.exposeInMainWorld("ClinicNovaNative", Object.freeze({
    platform: "desktop",
    hashSecret(secret, salt, iterations) { return ipcRenderer.sendSync("clinicnova:hash-secret", secret, salt, iterations); },
    connect(serverUrl) { return ipcRenderer.sendSync("clinicnova:connect", serverUrl); },
    openPortal(serverUrl, path) { return ipcRenderer.sendSync("clinicnova:open-portal", serverUrl, path); },
    sync(serverUrl, batchJson) {
      ipcRenderer.send("clinicnova:sync", serverUrl, batchJson);
    },
    onSyncResult(listener) {
      return addListener(listeners, listener);
    },
    productSearch(serverUrl, productUrl, itemId) { ipcRenderer.send("clinicnova:product-search", serverUrl, productUrl, itemId); },
    onProductSearchResult(listener) { return addListener(productSearchListeners, listener); },
    requestNotificationPermission() { return ipcRenderer.sendSync("clinicnova:request-notification-permission"); },
    showLocalNotification(title, body, tag) { return ipcRenderer.sendSync("clinicnova:show-local-notification", title, body, tag); },
    meshGetConfig() { return ipcRenderer.sendSync("clinicnova:mesh-get-config"); },
    meshGetEnvelope() { return ipcRenderer.sendSync("clinicnova:mesh-get-envelope"); },
    meshConfigure(json) { return ipcRenderer.sendSync("clinicnova:mesh-configure", json); },
    meshPublish(envelope) { return ipcRenderer.sendSync("clinicnova:mesh-publish", envelope); },
    meshSyncNow() { ipcRenderer.send("clinicnova:mesh-sync-now"); },
    meshDisable() { return ipcRenderer.sendSync("clinicnova:mesh-disable"); },
    onMeshEnvelope(listener) { return addListener(meshListeners, listener); },
    onMeshStatus(listener) { return addListener(meshStatusListeners, listener); },
    storage: Object.freeze({
      getItem(key) { return ipcRenderer.sendSync("clinicnova:storage-get", key); },
      setItem(key, value) { return ipcRenderer.sendSync("clinicnova:storage-set", key, value); },
      removeItem(key) { return ipcRenderer.sendSync("clinicnova:storage-remove", key); }
    })
  }));
}
