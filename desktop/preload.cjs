const { contextBridge, ipcRenderer } = require("electron");

if (window.location.protocol === "clinicnova:") {
  const listeners = new Set();
  const meshListeners = new Set();
  const meshStatusListeners = new Set();
  ipcRenderer.on("clinicnova:sync-result", (_event, status, responseText) => {
    for (const listener of listeners) listener(status, responseText);
  });
  ipcRenderer.on("clinicnova:mesh-envelope", (_event, envelope, peerName) => { for (const listener of meshListeners) listener(envelope, peerName); });
  ipcRenderer.on("clinicnova:mesh-status", (_event, status, peerName) => { for (const listener of meshStatusListeners) listener(status, peerName); });
  contextBridge.exposeInMainWorld("ClinicNovaNative", Object.freeze({
    platform: "desktop",
    sync(serverUrl, batchJson) {
      ipcRenderer.send("clinicnova:sync", serverUrl, batchJson);
    },
    onSyncResult(listener) {
      if (typeof listener === "function") listeners.add(listener);
    },
    meshGetConfig() { return ipcRenderer.sendSync("clinicnova:mesh-get-config"); },
    meshGetEnvelope() { return ipcRenderer.sendSync("clinicnova:mesh-get-envelope"); },
    meshConfigure(json) { return ipcRenderer.sendSync("clinicnova:mesh-configure", json); },
    meshPublish(envelope) { return ipcRenderer.sendSync("clinicnova:mesh-publish", envelope); },
    meshSyncNow() { ipcRenderer.send("clinicnova:mesh-sync-now"); },
    meshDisable() { return ipcRenderer.sendSync("clinicnova:mesh-disable"); },
    onMeshEnvelope(listener) { if (typeof listener === "function") meshListeners.add(listener); },
    onMeshStatus(listener) { if (typeof listener === "function") meshStatusListeners.add(listener); },
    storage: Object.freeze({
      getItem(key) { return ipcRenderer.sendSync("clinicnova:storage-get", key); },
      setItem(key, value) { return ipcRenderer.sendSync("clinicnova:storage-set", key, value); },
      removeItem(key) { return ipcRenderer.sendSync("clinicnova:storage-remove", key); }
    })
  }));
}
