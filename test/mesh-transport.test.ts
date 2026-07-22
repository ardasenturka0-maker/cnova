import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import test from "node:test";

const require = createRequire(import.meta.url);
const { MeshTransport, encrypt, decrypt, clinicHash, normalizeConfiguration, readFrame, MAX_ENVELOPE, MAX_FRAME } = require("../desktop/mesh-transport.cjs");

test("mesh transport encrypts and authenticates every LAN payload", () => {
  const secret = Buffer.alloc(32, 7);
  const payload = { clinicId: "clinic-one", deviceId: "device-a", envelope: { operations: [{ id: 1 }] } };
  const packet = encrypt(secret, payload);
  assert.deepEqual(decrypt(secret, packet), payload);
  assert.doesNotMatch(packet, /clinic-one|device-a|operations/);
  const tampered = JSON.parse(packet);
  const data = Buffer.from(tampered.data, "base64"); data[4] ^= 1; tampered.data = data.toString("base64");
  assert.throws(() => decrypt(secret, JSON.stringify(tampered)));
});

test("mesh envelope leaves enough room for authenticated base64 frame overhead", () => {
  assert.equal(MAX_ENVELOPE, 47 * 1024 * 1024);
  const maximumEncodedFrame = 4 * Math.ceil((MAX_ENVELOPE + 1024 + 16) / 3) + 128;
  assert.ok(maximumEncodedFrame < MAX_FRAME);
  assert.ok(Buffer.byteLength(encrypt(Buffer.alloc(32, 3), { envelope: "x".repeat(1024) }), "utf8") < MAX_FRAME);
});

test("clinic discovery identifiers cannot be correlated without the clinic key", () => {
  const first = clinicHash({ clinicId: "same", secret: Buffer.alloc(32, 1) });
  const second = clinicHash({ clinicId: "same", secret: Buffer.alloc(32, 2) });
  assert.notEqual(first, second);
  assert.equal(first, clinicHash({ clinicId: "same", secret: Buffer.alloc(32, 1) }));
});

test("mesh configuration enforces the same clinic and device identifiers as the shared engine", () => {
  const secret = Buffer.alloc(32, 5).toString("base64");
  const config = normalizeConfiguration({ clinicId: "clinic_123456", deviceId: "desktop-device:1", deviceName: "Desk\u0000top", secret });
  assert.equal(config.clinicId, "clinic_123456");
  assert.equal(config.deviceId, "desktop-device:1");
  assert.equal(config.deviceName, "Desk top");
  assert.throws(() => normalizeConfiguration({ clinicId: "short", deviceId: "desktop-device:1", secret }));
  assert.throws(() => normalizeConfiguration({ clinicId: "clinic_123456", deviceId: "bad/id", secret }));
  assert.throws(() => normalizeConfiguration({ clinicId: "clinic_123456", deviceId: "desktop-device:1", secret: Buffer.alloc(31).toString("base64") }));
});

test("mesh frame reader handles fragmentation and rejects truncated or oversized peers immediately", async () => {
  const fragmented = new PassThrough();
  const value = readFrame(fragmented, 1000);
  const body = Buffer.from("fragmented mesh value", "utf8");
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length);
  fragmented.write(header.subarray(0, 2));
  fragmented.write(Buffer.concat([header.subarray(2), body.subarray(0, 3)]));
  fragmented.write(body.subarray(3));
  assert.equal(await value, body.toString("utf8"));
  fragmented.end();

  const truncated = new PassThrough();
  const truncatedResult = readFrame(truncated, 1000);
  const expectedFive = Buffer.alloc(4); expectedFive.writeUInt32BE(5);
  truncated.end(Buffer.concat([expectedFive, Buffer.from("no")]));
  await assert.rejects(truncatedResult, /tamamlanmadan/);

  const oversized = new PassThrough();
  const oversizedResult = readFrame(oversized, 1000);
  const tooLarge = Buffer.alloc(4); tooLarge.writeUInt32BE(MAX_FRAME + 1);
  oversized.end(tooLarge);
  await assert.rejects(oversizedResult, /paket boyutu/);
});

test("two native peers exchange both durable envelopes over an interrupted-safe frame", async () => {
  const secret = Buffer.alloc(32, 9).toString("base64");
  let receivedByA: unknown = null; let receivedByB: unknown = null;
  const a = new MeshTransport({ getEnvelope: () => ({ operations: ["a"] }), onEnvelope: (value: unknown) => { receivedByA = value; }, onStatus: () => undefined });
  const b = new MeshTransport({ getEnvelope: () => ({ operations: ["b"] }), onEnvelope: (value: unknown) => { receivedByB = value; }, onStatus: () => undefined });
  try {
    a.configure({ clinicId: "clinic-loopback", deviceId: "device-loopback-a", deviceName: "A", secret });
    b.configure({ clinicId: "clinic-loopback", deviceId: "device-loopback-b", deviceName: "B", secret });
    const deadline = Date.now() + 3000;
    while ((!a.port || !b.port) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(a.port && b.port);
    await a.connect("127.0.0.1", b.port, "B");
    assert.deepEqual(receivedByA, { operations: ["b"] });
    assert.deepEqual(receivedByB, { operations: ["a"] });
  } finally { a.stop(); b.stop(); }
});

test("authenticated Bonjour TXT discovery connects Apple and non-Apple peers", async () => {
  const secret = Buffer.alloc(32, 11).toString("base64");
  let received: unknown = null;
  const apple = new MeshTransport({ getEnvelope: () => ({ operations: ["apple"] }), onEnvelope: () => undefined, onStatus: () => undefined });
  const android = new MeshTransport({ getEnvelope: () => ({ operations: ["android"] }), onEnvelope: (value: unknown) => { received = value; }, onStatus: () => undefined });
  try {
    apple.configure({ clinicId: "clinic-bonjour", deviceId: "device-apple-one", deviceName: "iPhone", secret });
    android.configure({ clinicId: "clinic-bonjour", deviceId: "device-android-one", deviceName: "Android", secret });
    const deadline = Date.now() + 3000;
    while (!apple.port && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    const txt = Object.fromEntries(Object.entries(apple.announcement()).map(([key, value]) => [key, String(value)]));
    android.discoveredValue(txt, "127.0.0.1", apple.port);
    while (!received && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(received, { operations: ["apple"] });
  } finally { apple.stop(); android.stop(); }
});
