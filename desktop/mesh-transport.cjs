const crypto = require("node:crypto");
const dgram = require("node:dgram");
const nodeNet = require("node:net");
const os = require("node:os");
const { Bonjour } = require("bonjour-service");

const DISCOVERY_PORT = 45872;
const MAX_FRAME = 64 * 1024 * 1024;
const PROTOCOL = 1;

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function clinicHash(config) { return hmac(config.secret, `clinic:${config.clinicId}`); }

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
  if (body.length > MAX_FRAME) throw new Error("Eşitleme paketi çok büyük.");
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length);
  socket.write(Buffer.concat([header, body]));
}

function readFrame(socket, timeout = 15000) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0); let expected = null;
    const timer = setTimeout(() => done(new Error("Eşitleme zaman aşımına uğradı.")), timeout);
    function done(error, value) { clearTimeout(timer); socket.off("data", data); socket.off("error", fail); error ? reject(error) : resolve(value); }
    function fail(error) { done(error); }
    function data(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      if (expected === null && buffer.length >= 4) { expected = buffer.readUInt32BE(0); buffer = buffer.subarray(4); if (expected <= 0 || expected > MAX_FRAME) return done(new Error("Geçersiz paket boyutu.")); }
      if (expected !== null && buffer.length >= expected) done(null, buffer.subarray(0, expected).toString("utf8"));
    }
    socket.on("data", data); socket.once("error", fail);
  });
}

class MeshTransport {
  constructor({ getEnvelope, onEnvelope, onStatus }) {
    this.getEnvelope = getEnvelope; this.onEnvelope = onEnvelope; this.onStatus = onStatus;
    this.config = null; this.udp = null; this.server = null; this.port = 0; this.timer = null; this.connecting = new Set(); this.bonjour = null; this.bonjourService = null; this.bonjourBrowser = null;
  }

  configure(input) {
    const secret = Buffer.from(String(input?.secret || ""), "base64");
    if (!input?.clinicId || !input?.deviceId || secret.length !== 32) throw new Error("Geçersiz klinik ağı yapılandırması.");
    this.stop();
    this.config = { clinicId: String(input.clinicId), deviceId: String(input.deviceId), deviceName: String(input.deviceName || os.hostname()).slice(0, 80), secret };
    this.start();
  }

  start() {
    if (!this.config) return;
    this.server = nodeNet.createServer(socket => void this.accept(socket));
    this.server.on("error", error => this.onStatus(`Yerel ağ dinleyicisi: ${error.message}`));
    this.server.listen(0, "0.0.0.0", () => { this.port = this.server.address().port; this.startDiscovery(); });
  }

  startDiscovery() {
    this.udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.udp.on("message", (data, remote) => this.discovered(data, remote));
    this.udp.on("error", error => this.onStatus(`Yerel ağ keşfi: ${error.message}`));
    this.udp.bind(DISCOVERY_PORT, () => { this.udp.setBroadcast(true); this.announce(); });
    this.startBonjour();
    this.timer = setInterval(() => this.announce(), 8000);
    this.onStatus("Yerel ağda eşler aranıyor");
  }

  announcement() {
    const base = { v: PROTOCOL, clinicHash: clinicHash(this.config), deviceId: this.config.deviceId, deviceName: this.config.deviceName, port: this.port, nonce: crypto.randomBytes(12).toString("base64url") };
    return { ...base, mac: hmac(this.config.secret, [base.v, base.clinicHash, base.deviceId, base.deviceName, base.port, base.nonce].join("|")) };
  }

  startBonjour() {
    try {
      const value = this.announcement();
      this.bonjour = new Bonjour();
      this.bonjourService = this.bonjour.publish({ name: `ClinicNova-${this.config.deviceId}`, type: "clinicnova", protocol: "tcp", port: this.port, txt: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)])) });
      this.bonjourBrowser = this.bonjour.find({ type: "clinicnova", protocol: "tcp" }, service => {
        const addresses = Array.isArray(service.addresses) ? service.addresses : [];
        const host = addresses.find(address => nodeNet.isIPv4(address) && !address.startsWith("127."));
        if (host) this.discoveredValue(service.txt || {}, host, service.port);
      });
    } catch (error) { this.onStatus(`Apple cihaz keşfi: ${error.message}`); }
  }

  announce() {
    if (!this.udp || !this.config || !this.port) return;
    const data = Buffer.from(JSON.stringify(this.announcement()));
    for (const address of ["255.255.255.255", ...Object.values(os.networkInterfaces()).flat().filter(Boolean).filter(x => x.family === "IPv4" && !x.internal && x.netmask).map(x => {
      const ip = x.address.split(".").map(Number), mask = x.netmask.split(".").map(Number);
      return ip.map((part, i) => (part & mask[i]) | (255 ^ mask[i])).join(".");
    })]) this.udp.send(data, DISCOVERY_PORT, address, () => {});
  }

  discovered(data, remote) {
    try {
      const value = JSON.parse(data.toString("utf8"));
      this.discoveredValue(value, remote.address, value.port);
    } catch { /* Ignore unauthenticated discovery traffic. */ }
  }

  discoveredValue(value, host, advertisedPort) {
    try {
      const normalized = { v: Number(value.v), clinicHash: String(value.clinicHash || ""), deviceId: String(value.deviceId || ""), deviceName: String(value.deviceName || ""), port: Number(value.port), nonce: String(value.nonce || ""), mac: String(value.mac || "") };
      if (normalized.v !== PROTOCOL || normalized.deviceId === this.config.deviceId || normalized.clinicHash !== clinicHash(this.config)) return;
      const expected = hmac(this.config.secret, [normalized.v, normalized.clinicHash, normalized.deviceId, normalized.deviceName, normalized.port, normalized.nonce].join("|"));
      if (!crypto.timingSafeEqual(Buffer.from(normalized.mac), Buffer.from(expected))) return;
      const port = Number(advertisedPort || normalized.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535 || port !== normalized.port) return;
      const key = `${host}:${port}`;
      if (this.connecting.has(key)) return;
      this.connecting.add(key);
      void this.connect(host, port, normalized.deviceName).finally(() => this.connecting.delete(key));
    } catch { /* Ignore unauthenticated discovery traffic. */ }
  }

  message() { return { v: PROTOCOL, clinicId: this.config.clinicId, deviceId: this.config.deviceId, deviceName: this.config.deviceName, envelope: this.getEnvelope() || null }; }

  async accept(socket) {
    try {
      const incoming = decrypt(this.config.secret, await readFrame(socket));
      if (incoming.v !== PROTOCOL || incoming.clinicId !== this.config.clinicId || incoming.deviceId === this.config.deviceId) throw new Error("Klinik ağı eşleşmiyor.");
      writeFrame(socket, encrypt(this.config.secret, this.message()));
      if (incoming.envelope) this.onEnvelope(incoming.envelope, String(incoming.deviceName || "Klinik cihazı"));
      this.onStatus("Yerel eşitleme tamamlandı", incoming.deviceName);
    } catch (error) { this.onStatus(`Eşitleme reddedildi: ${error.message}`); }
    finally { socket.end(); }
  }

  async connect(host, port, peerName) {
    const socket = nodeNet.createConnection({ host, port, timeout: 10000 });
    try {
      await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject); });
      writeFrame(socket, encrypt(this.config.secret, this.message()));
      const incoming = decrypt(this.config.secret, await readFrame(socket));
      if (incoming.v !== PROTOCOL || incoming.clinicId !== this.config.clinicId) throw new Error("Klinik ağı eşleşmiyor.");
      if (incoming.envelope) this.onEnvelope(incoming.envelope, String(incoming.deviceName || peerName || "Klinik cihazı"));
      this.onStatus("Yerel eşitleme tamamlandı", incoming.deviceName || peerName);
    } catch (error) { this.onStatus(`Eşitleme tekrar denenecek: ${error.message}`, peerName); }
    finally { socket.destroy(); }
  }

  syncNow() { this.announce(); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; try { this.bonjourBrowser?.stop(); } catch {} try { this.bonjourService?.stop(); } catch {} try { this.bonjour?.destroy(); } catch {} this.bonjourBrowser = null; this.bonjourService = null; this.bonjour = null; try { if (this.udp) this.udp.close(); } catch {} try { if (this.server) this.server.close(); } catch {} this.udp = null; this.server = null; this.port = 0; this.connecting.clear(); }
}

module.exports = { MeshTransport, encrypt, decrypt, clinicHash, DISCOVERY_PORT, MAX_FRAME };
