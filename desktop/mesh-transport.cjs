const crypto = require("node:crypto");
const dgram = require("node:dgram");
const nodeNet = require("node:net");
const os = require("node:os");
const { Bonjour } = require("bonjour-service");

const DISCOVERY_PORT = 45872;
const MAX_FRAME = 64 * 1024 * 1024;
const MAX_ENVELOPE = 47 * 1024 * 1024;
const PROTOCOL = 1;
const CLINIC_ID = /^[A-Za-z0-9_-]{8,128}$/;
const DEVICE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function clinicHash(config) { return hmac(config.secret, `clinic:${config.clinicId}`); }

function secureTextEqual(left, right) {
  const first = Buffer.from(String(left || ""), "utf8");
  const second = Buffer.from(String(right || ""), "utf8");
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function cleanDeviceName(value, fallback = "ClinicNova") {
  const result = String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80);
  return result || fallback;
}

function normalizeConfiguration(input) {
  const clinicId = String(input?.clinicId || "");
  const deviceId = String(input?.deviceId || "");
  const secretText = String(input?.secret || "");
  const secret = Buffer.from(secretText, "base64");
  const canonicalSecret = secret.toString("base64").replace(/=+$/, "");
  if (!CLINIC_ID.test(clinicId) || !DEVICE_ID.test(deviceId) || secret.length !== 32 || canonicalSecret !== secretText.replace(/=+$/, "")) {
    throw new Error("Geçersiz klinik ağı yapılandırması.");
  }
  return { clinicId, deviceId, deviceName: cleanDeviceName(input?.deviceName, os.hostname()), secret };
}

function encrypt(secret, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ v: PROTOCOL, iv: iv.toString("base64"), data: Buffer.concat([ciphertext, cipher.getAuthTag()]).toString("base64") });
}

function decrypt(secret, packet) {
  const outer = JSON.parse(packet);
  const iv = Buffer.from(String(outer.iv || ""), "base64");
  const combined = Buffer.from(String(outer.data || ""), "base64");
  if (outer.v !== PROTOCOL || iv.length !== 12 || combined.length < 17 || combined.length > MAX_FRAME) throw new Error("Geçersiz şifreli paket.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAuthTag(combined.subarray(combined.length - 16));
  return JSON.parse(Buffer.concat([decipher.update(combined.subarray(0, -16)), decipher.final()]).toString("utf8"));
}

function writeFrame(socket, text) {
  const body = Buffer.from(text, "utf8");
  if (body.length <= 0 || body.length > MAX_FRAME) throw new Error("Eşitleme paketi çok büyük.");
  const header = Buffer.allocUnsafe(4); header.writeUInt32BE(body.length);
  socket.write(header); socket.write(body);
}

function readFrame(socket, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const header = Buffer.allocUnsafe(4);
    let headerOffset = 0;
    let body = null;
    let bodyOffset = 0;
    let settled = false;
    const timer = setTimeout(() => done(new Error("Eşitleme zaman aşımına uğradı.")), timeout);
    function cleanup() {
      clearTimeout(timer);
      socket.off("data", onData); socket.off("error", onError); socket.off("end", onEnd); socket.off("close", onClose);
    }
    function done(error, value) {
      if (settled) return;
      settled = true; cleanup();
      if (error) reject(error); else resolve(value);
    }
    function onError(error) { done(error); }
    function onEnd() { done(new Error("Eş bağlantıyı paket tamamlanmadan kapattı.")); }
    function onClose() { done(new Error("Eş bağlantısı paket tamamlanmadan kapandı.")); }
    function onData(chunk) {
      let offset = 0;
      while (offset < chunk.length && !settled) {
        if (headerOffset < 4) {
          const copied = chunk.copy(header, headerOffset, offset, offset + Math.min(4 - headerOffset, chunk.length - offset));
          headerOffset += copied; offset += copied;
          if (headerOffset < 4) continue;
          const expected = header.readUInt32BE(0);
          if (expected <= 0 || expected > MAX_FRAME) return done(new Error("Geçersiz paket boyutu."));
          body = Buffer.allocUnsafe(expected);
        }
        const copied = chunk.copy(body, bodyOffset, offset, offset + Math.min(body.length - bodyOffset, chunk.length - offset));
        bodyOffset += copied; offset += copied;
        if (bodyOffset === body.length) return done(null, body.toString("utf8"));
      }
    }
    socket.on("data", onData); socket.once("error", onError); socket.once("end", onEnd); socket.once("close", onClose);
  });
}

function waitForConnection(socket, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => done(new Error("Eş bağlantısı zaman aşımına uğradı.")), timeout);
    function cleanup() { clearTimeout(timer); socket.off("connect", onConnect); socket.off("error", onError); socket.off("close", onClose); }
    function done(error) { if (settled) return; settled = true; cleanup(); error ? reject(error) : resolve(); }
    function onConnect() { done(); }
    function onError(error) { done(error); }
    function onClose() { done(new Error("Eş bağlantısı kurulmadan kapandı.")); }
    socket.once("connect", onConnect); socket.once("error", onError); socket.once("close", onClose);
  });
}

function validPeerMessage(value, config) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && value.v === PROTOCOL &&
    value.clinicId === config.clinicId && DEVICE_ID.test(String(value.deviceId || "")) && value.deviceId !== config.deviceId &&
    (value.envelope === null || (value.envelope && typeof value.envelope === "object" && !Array.isArray(value.envelope)))
  );
}

class MeshTransport {
  constructor({ getEnvelope, onEnvelope, onStatus }) {
    this.getEnvelope = getEnvelope;
    this.onEnvelope = onEnvelope;
    this.onStatus = onStatus;
    this.config = null;
    this.udp = null;
    this.udpBound = false;
    this.server = null;
    this.port = 0;
    this.timer = null;
    this.connecting = new Set();
    this.sockets = new Set();
    this.bonjour = null;
    this.bonjourService = null;
    this.bonjourBrowser = null;
    this.generation = 0;
  }

  current(generation, config) { return this.generation === generation && this.config === config; }

  configure(input) {
    const next = normalizeConfiguration(input);
    this.stop();
    this.config = next;
    this.start();
  }

  trackSocket(socket) {
    this.sockets.add(socket);
    socket.once("close", () => this.sockets.delete(socket));
  }

  start() {
    if (!this.config) return;
    const generation = this.generation;
    const config = this.config;
    const server = nodeNet.createServer(socket => {
      if (!this.current(generation, config)) { socket.destroy(); return; }
      this.trackSocket(socket); socket.setNoDelay(true);
      void this.accept(socket, generation, config);
    });
    // Each peer may announce a large encrypted snapshot, so keep unauthenticated
    // inbound memory pressure bounded while preserving normal clinic concurrency.
    server.maxConnections = 4;
    server.on("error", error => { if (this.current(generation, config)) this.onStatus(`Yerel ağ dinleyicisi: ${error.message}`); });
    this.server = server;
    server.listen(0, "0.0.0.0", () => {
      if (!this.current(generation, config) || this.server !== server) { try { server.close(); } catch {} return; }
      const address = server.address();
      if (!address || typeof address === "string") { this.onStatus("Yerel ağ dinleyicisi başlatılamadı"); return; }
      this.port = address.port;
      this.startDiscovery(generation, config);
    });
  }

  startDiscovery(generation, config) {
    if (!this.current(generation, config)) return;
    const udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.udp = udp;
    udp.on("message", (data, remote) => { if (this.current(generation, config)) this.discovered(data, remote, generation, config); });
    udp.on("error", error => { if (this.current(generation, config)) this.onStatus(`Yerel ağ keşfi: ${error.message}`); });
    udp.bind(DISCOVERY_PORT, () => {
      if (!this.current(generation, config) || this.udp !== udp) { try { udp.close(); } catch {} return; }
      try { udp.setBroadcast(true); this.udpBound = true; this.announce(generation, config); }
      catch (error) { this.onStatus(`Yerel ağ yayını: ${error.message}`); }
    });
    this.startBonjour(generation, config);
    this.timer = setInterval(() => this.announce(generation, config), 8000);
    this.onStatus("Yerel ağda eşler aranıyor");
  }

  announcement(config = this.config) {
    if (!config || !this.port) throw new Error("Yerel ağ dinleyicisi hazır değil.");
    const base = {
      v: PROTOCOL,
      clinicHash: clinicHash(config),
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      port: this.port,
      nonce: crypto.randomBytes(12).toString("base64url")
    };
    return { ...base, mac: hmac(config.secret, [base.v, base.clinicHash, base.deviceId, base.deviceName, base.port, base.nonce].join("|")) };
  }

  startBonjour(generation, config) {
    try {
      const value = this.announcement(config);
      const bonjour = new Bonjour();
      const service = bonjour.publish({
        name: `ClinicNova-${config.deviceId.slice(-16)}`,
        type: "clinicnova",
        protocol: "tcp",
        port: this.port,
        txt: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]))
      });
      const browser = bonjour.find({ type: "clinicnova", protocol: "tcp" }, found => {
        if (!this.current(generation, config)) return;
        const addresses = Array.isArray(found.addresses) ? found.addresses : [];
        const host = addresses.find(address => nodeNet.isIPv4(address) && !address.startsWith("127."));
        if (host) this.discoveredValue(found.txt || {}, host, found.port, generation, config);
      });
      service.on?.("error", error => { if (this.current(generation, config)) this.onStatus(`Apple cihaz yayını: ${error.message}`); });
      browser.on?.("error", error => { if (this.current(generation, config)) this.onStatus(`Apple cihaz keşfi: ${error.message}`); });
      if (!this.current(generation, config)) { try { browser.stop(); service.stop(); bonjour.destroy(); } catch {} return; }
      this.bonjour = bonjour; this.bonjourService = service; this.bonjourBrowser = browser;
    } catch (error) { if (this.current(generation, config)) this.onStatus(`Apple cihaz keşfi: ${error.message}`); }
  }

  announce(generation = this.generation, config = this.config) {
    if (!this.current(generation, config) || !this.udp || !this.udpBound || !this.port) return;
    let data;
    try { data = Buffer.from(JSON.stringify(this.announcement(config))); } catch { return; }
    const addresses = new Set(["255.255.255.255"]);
    for (const item of Object.values(os.networkInterfaces()).flat().filter(Boolean)) {
      if (!(["IPv4", 4].includes(item.family)) || item.internal || !item.netmask) continue;
      const ip = item.address.split(".").map(Number), mask = item.netmask.split(".").map(Number);
      if (ip.length !== 4 || mask.length !== 4 || [...ip, ...mask].some(part => !Number.isInteger(part) || part < 0 || part > 255)) continue;
      addresses.add(ip.map((part, index) => (part & mask[index]) | (255 ^ mask[index])).join("."));
    }
    for (const address of addresses) try { this.udp.send(data, DISCOVERY_PORT, address, () => {}); } catch { /* Retry on the next interval. */ }
  }

  discovered(data, remote, generation = this.generation, config = this.config) {
    try {
      if (!Buffer.isBuffer(data) || data.length > 4096 || !nodeNet.isIPv4(remote.address)) return;
      this.discoveredValue(JSON.parse(data.toString("utf8")), remote.address, undefined, generation, config);
    } catch { /* Ignore unauthenticated discovery traffic. */ }
  }

  discoveredValue(value, host, advertisedPort, generation = this.generation, config = this.config) {
    try {
      if (!this.current(generation, config) || !nodeNet.isIPv4(host)) return;
      const normalized = {
        v: Number(value.v),
        clinicHash: String(value.clinicHash || ""),
        deviceId: String(value.deviceId || ""),
        deviceName: String(value.deviceName || ""),
        port: Number(value.port),
        nonce: String(value.nonce || ""),
        mac: String(value.mac || "")
      };
      if (
        normalized.v !== PROTOCOL || !DEVICE_ID.test(normalized.deviceId) || normalized.deviceId === config.deviceId ||
        normalized.deviceName.length > 80 || !/^[A-Za-z0-9_-]{16}$/.test(normalized.nonce) ||
        !secureTextEqual(normalized.clinicHash, clinicHash(config))
      ) return;
      const expected = hmac(config.secret, [normalized.v, normalized.clinicHash, normalized.deviceId, normalized.deviceName, normalized.port, normalized.nonce].join("|"));
      if (!secureTextEqual(normalized.mac, expected)) return;
      const port = Number(advertisedPort ?? normalized.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535 || port !== normalized.port) return;
      const key = `${host}:${port}`;
      if (this.connecting.has(key)) return;
      this.connecting.add(key);
      void this.connect(host, port, cleanDeviceName(normalized.deviceName, "Klinik cihazı"), generation, config).finally(() => this.connecting.delete(key));
    } catch { /* Ignore unauthenticated discovery traffic. */ }
  }

  message(config = this.config) {
    const envelope = this.getEnvelope() || null;
    if (envelope !== null && (!envelope || typeof envelope !== "object" || Array.isArray(envelope))) throw new Error("Cihaz eşitleme paketi geçersiz.");
    if (envelope !== null && Buffer.byteLength(JSON.stringify(envelope), "utf8") > MAX_ENVELOPE) throw new Error("Cihaz eşitleme paketi çok büyük.");
    return { v: PROTOCOL, clinicId: config.clinicId, deviceId: config.deviceId, deviceName: config.deviceName, envelope };
  }

  async accept(socket, generation = this.generation, config = this.config) {
    try {
      const incoming = decrypt(config.secret, await readFrame(socket));
      if (!this.current(generation, config) || !validPeerMessage(incoming, config)) throw new Error("Klinik ağı eşleşmiyor.");
      writeFrame(socket, encrypt(config.secret, this.message(config)));
      if (incoming.envelope) this.onEnvelope(incoming.envelope, cleanDeviceName(incoming.deviceName, "Klinik cihazı"));
      this.onStatus("Yerel eşitleme tamamlandı", cleanDeviceName(incoming.deviceName, "Klinik cihazı"));
    } catch (error) {
      if (this.current(generation, config)) this.onStatus(`Eşitleme reddedildi: ${error.message}`);
    } finally { socket.end(); }
  }

  async connect(host, port, peerName, generation = this.generation, config = this.config) {
    if (!config || !nodeNet.isIPv4(host) || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) return;
    const socket = nodeNet.createConnection({ host, port: Number(port) });
    this.trackSocket(socket); socket.setNoDelay(true);
    try {
      await waitForConnection(socket);
      if (!this.current(generation, config)) throw new Error("Klinik ağı yeniden yapılandırıldı.");
      writeFrame(socket, encrypt(config.secret, this.message(config)));
      const incoming = decrypt(config.secret, await readFrame(socket));
      if (!this.current(generation, config) || !validPeerMessage(incoming, config)) throw new Error("Klinik ağı eşleşmiyor.");
      if (incoming.envelope) this.onEnvelope(incoming.envelope, cleanDeviceName(incoming.deviceName, peerName || "Klinik cihazı"));
      this.onStatus("Yerel eşitleme tamamlandı", cleanDeviceName(incoming.deviceName, peerName || "Klinik cihazı"));
    } catch (error) {
      if (this.current(generation, config)) this.onStatus(`Eşitleme tekrar denenecek: ${error.message}`, cleanDeviceName(peerName, "Klinik cihazı"));
    } finally { socket.destroy(); }
  }

  syncNow() {
    this.onStatus("Android, iPhone, Windows ve Mac cihazları yeniden taranıyor");
    this.announce();
  }

  stop() {
    this.generation += 1;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try { this.bonjourBrowser?.stop(); } catch {}
    try { this.bonjourService?.stop(); } catch {}
    try { this.bonjour?.destroy(); } catch {}
    this.bonjourBrowser = null; this.bonjourService = null; this.bonjour = null;
    for (const socket of this.sockets) try { socket.destroy(); } catch {}
    this.sockets.clear();
    try { this.udp?.close(); } catch {}
    try { this.server?.close(); } catch {}
    this.udp = null; this.udpBound = false; this.server = null; this.port = 0;
    this.connecting.clear();
  }
}

module.exports = {
  MeshTransport,
  encrypt,
  decrypt,
  clinicHash,
  normalizeConfiguration,
  readFrame,
  DISCOVERY_PORT,
  MAX_ENVELOPE,
  MAX_FRAME
};
