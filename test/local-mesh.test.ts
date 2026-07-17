import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../mobile/assets/mesh-sync.js", import.meta.url), "utf8");
function meshApi() {
  const context = { window: {} as Record<string, unknown>, structuredClone, JSON, Object, Array, Map, Set, Date, Math, String, Number, Error };
  vm.runInNewContext(source, context);
  return context.window.ClinicNovaMeshEngine as {
    digest: (value: unknown) => string;
    MeshEngine: new (options: unknown) => {
      capture: (document: unknown) => number;
      merge: (envelope: unknown) => unknown;
      export: () => unknown;
      materialize: () => { document: Record<string, unknown[]>; conflicts: unknown[] };
      resolveConflict: (key: string, operationId: string) => { document: Record<string, unknown[]>; conflicts: unknown[] };
    };
  };
}
function engine(deviceId: string, state?: unknown) {
  const MeshEngine = meshApi().MeshEngine;
  return new MeshEngine({ clinicId: "clinic-mesh-test", deviceId, state });
}

test("offline peers converge after exchanging immutable operation logs", () => {
  const phone = engine("phone-device"); const desktop = engine("desktop-device");
  phone.capture({ patients: [{ id: 1, name: "Ayşe" }] });
  desktop.capture({ appointments: [{ id: 2, patientId: 1, treatment: "Kontrol" }] });
  phone.merge(desktop.export()); desktop.merge(phone.export());
  assert.deepEqual(JSON.parse(JSON.stringify(phone.materialize().document)), JSON.parse(JSON.stringify(desktop.materialize().document)));
  assert.equal(phone.materialize().document.patients.length, 1);
  assert.equal(phone.materialize().document.appointments.length, 1);
});

test("concurrent edits converge deterministically and preserve a conflict record", () => {
  const seed = engine("seed-device"); seed.capture({ patients: [{ id: 1, name: "İlk", phone: "100" }] });
  const phone = engine("phone-device", seed.export()); const desktop = engine("desktop-device", seed.export());
  phone.capture({ patients: [{ id: 1, name: "Telefon", phone: "100" }] });
  desktop.capture({ patients: [{ id: 1, name: "Masaüstü", phone: "100" }] });
  phone.merge(desktop.export()); desktop.merge(phone.export());
  assert.deepEqual(JSON.parse(JSON.stringify(phone.materialize())), JSON.parse(JSON.stringify(desktop.materialize())));
  assert.equal(phone.materialize().conflicts.length, 1);
  assert.equal((phone.materialize().conflicts[0] as { variants: unknown[] }).variants.length, 2);
});

test("a human conflict choice becomes a causal operation and converges everywhere", () => {
  const seed = engine("seed-device"); seed.capture({ patients: [{ id: 1, name: "İlk" }] });
  const phone = engine("phone-device", seed.export()); const desktop = engine("desktop-device", seed.export());
  phone.capture({ patients: [{ id: 1, name: "Telefon" }] }); desktop.capture({ patients: [{ id: 1, name: "Masaüstü" }] });
  phone.merge(desktop.export());
  const conflict = phone.materialize().conflicts[0] as { key: string; variants: Array<{ operationId: string; payload: { name: string } }> };
  const chosen = conflict.variants.find((item) => item.payload.name === "Telefon")!;
  const resolved = phone.resolveConflict(conflict.key, chosen.operationId);
  assert.equal(resolved.conflicts.length, 0);
  desktop.merge(phone.export());
  assert.equal((desktop.materialize().document.patients[0] as { name: string }).name, "Telefon");
  assert.equal(desktop.materialize().conflicts.length, 0);
});

test("a causal delete wins while a concurrent update is retained for safety", () => {
  const seed = engine("seed-device"); seed.capture({ patients: [{ id: 1, name: "Hasta" }] });
  const deleter = engine("delete-device", seed.export());
  deleter.capture({ patients: [] });
  assert.equal(deleter.materialize().document.patients, undefined);

  const updater = engine("update-device", seed.export());
  updater.capture({ patients: [{ id: 1, name: "Yeni bilgi" }] });
  deleter.merge(updater.export()); updater.merge(deleter.export());
  assert.equal((deleter.materialize().document.patients[0] as { name: string }).name, "Yeni bilgi");
  assert.equal(deleter.materialize().conflicts.length, 1);
});

test("three peers converge transitively and retries stay idempotent", () => {
  const a = engine("device-a1"); const b = engine("device-b1"); const c = engine("device-c1");
  a.capture({ patients: [{ id: 1, name: "A" }] });
  b.capture({ stockItems: [{ id: 2, name: "B" }] });
  c.capture({ recalls: [{ id: 3, reason: "C" }] });
  a.merge(b.export()); b.merge(c.export()); c.merge(a.export());
  a.merge(c.export()); b.merge(a.export()); c.merge(b.export());
  const expected = JSON.parse(JSON.stringify(a.materialize().document));
  assert.deepEqual(JSON.parse(JSON.stringify(b.materialize().document)), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(c.materialize().document)), expected);
  const before = JSON.stringify(a.export()); a.merge(b.export()); assert.equal(JSON.stringify(a.export()), before);
});

test("tampered envelopes and broken device chains are rejected", () => {
  const sourceEngine = engine("source-device"); sourceEngine.capture({ patients: [{ id: 1, name: "Hasta" }] });
  const tampered = JSON.parse(JSON.stringify(sourceEngine.export()));
  tampered.operations[0].payload.name = "Değiştirildi";
  assert.throws(() => engine("target-device").merge(tampered), /bütünlük|bozuk/);

  sourceEngine.capture({ patients: [{ id: 1, name: "Hasta 2" }] });
  const broken = JSON.parse(JSON.stringify(sourceEngine.export()));
  broken.operations[1].prevHash = "wrong";
  broken.digest = "invalid";
  assert.throws(() => engine("target-two").merge(broken), /bütünlük|zinciri|bozuk/);

  const missingStart = JSON.parse(JSON.stringify(sourceEngine.export()));
  missingStart.operations.shift();
  missingStart.digest = meshApi().digest(missingStart.operations);
  assert.throws(() => engine("target-three").merge(missingStart), /başlangıcı/);

  const forgedVector = JSON.parse(JSON.stringify(sourceEngine.export()));
  forgedVector.operations[0].vector[forgedVector.operations[0].deviceId] = 99;
  assert.throws(() => engine("target-four").merge(forgedVector), /bütünlük|bozuk/);
});
