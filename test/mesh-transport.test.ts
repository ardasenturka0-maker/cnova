import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { MeshTransport, encrypt, decrypt, clinicHash } = require("../desktop/mesh-transport.cjs");

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

test("clinic discovery identifiers cannot be correlated without the clinic key", () => {
  const first = clinicHash({ clinicId: "same", secret: Buffer.alloc(32, 1) });
  const second = clinicHash({ clinicId: "same", secret: Buffer.alloc(32, 2) });
  assert.notEqual(first, second);
  assert.equal(first, clinicHash({ clinicId: "same", secret: Buffer.alloc(32, 1) }));
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
