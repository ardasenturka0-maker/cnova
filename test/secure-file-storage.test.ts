import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { assertFileSecurityReady, deleteStoredPatientFile, preparePatientUpload, readPatientFile, reencryptStoredPatientFile, storePatientFile } from "../src/lib/secure-file-storage";

test("patient images are resized, encrypted outside the database and integrity checked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-storage-test-"));
  process.env.FILE_STORAGE_ROOT = root;
  process.env.FILE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.FILE_AV_REQUIRED = "false";
  process.env.FILE_AV_COMMAND = "clinicnova-missing-test-scanner";
  try {
    const original = await sharp({ create: { width: 3200, height: 1800, channels: 3, background: "#1476ff" } }).png().toBuffer();
    const prepared = await preparePatientUpload(original);
    const metadata = await sharp(prepared.bytes).metadata();
    assert.equal(prepared.mimeType, "image/png");
    assert.equal(metadata.width, 2560);

    const storageKey = await storePatientFile("org/unsafe", "patient-1", prepared);
    const encrypted = await readFile(path.join(root, storageKey));
    assert.equal(encrypted.subarray(0, 4).toString(), "CNV2");
    assert.notDeepEqual(encrypted.subarray(32), prepared.bytes);
    assert.deepEqual(await readPatientFile(storageKey, prepared.checksumSha256), prepared.bytes);
    await deleteStoredPatientFile(storageKey);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file encryption key rotation preserves data and requires the retained old key", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-key-rotation-"));
  process.env.FILE_STORAGE_ROOT = root;
  const oldKey = Buffer.alloc(32, 41).toString("base64");
  const newKey = Buffer.alloc(32, 42).toString("base64");
  process.env.FILE_ENCRYPTION_KEYS = JSON.stringify({ old: oldKey, next: newKey });
  process.env.FILE_ENCRYPTION_ACTIVE_KEY_ID = "old";
  try {
    const bytes = Buffer.from("rotation-sensitive-content");
    const storageKey = await storePatientFile("org", "patient", { bytes, mimeType: "application/pdf", extension: "pdf", checksumSha256: "" });
    process.env.FILE_ENCRYPTION_ACTIVE_KEY_ID = "next";
    await reencryptStoredPatientFile(storageKey);
    process.env.FILE_ENCRYPTION_KEYS = JSON.stringify({ next: newKey });
    assert.deepEqual(await readPatientFile(storageKey), bytes);
  } finally {
    delete process.env.FILE_ENCRYPTION_KEYS;
    delete process.env.FILE_ENCRYPTION_ACTIVE_KEY_ID;
    await rm(root, { recursive: true, force: true });
  }
});

test("file type is read from its signature, not the browser MIME claim", async () => {
  await assert.rejects(() => preparePatientUpload(Buffer.from("not really a jpeg")), /Dosya içeriği/);
});

test("encrypted files reject tampering, the wrong key and a false checksum", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-tamper-test-"));
  process.env.FILE_STORAGE_ROOT = root;
  const correctKey = Buffer.alloc(32, 11).toString("base64");
  process.env.FILE_ENCRYPTION_KEY = correctKey;
  try {
    const prepared = { bytes: Buffer.from("sensitive patient document"), mimeType: "application/pdf", extension: "pdf", checksumSha256: "expected-checksum" };
    const storageKey = await storePatientFile("org", "patient", prepared);
    await assert.rejects(() => readPatientFile(storageKey, "wrong-checksum"), /bütünlük/);

    process.env.FILE_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
    await assert.rejects(() => readPatientFile(storageKey));
    process.env.FILE_ENCRYPTION_KEY = correctKey;

    const encryptedPath = path.join(root, storageKey);
    const encrypted = await readFile(encryptedPath);
    encrypted[encrypted.length - 1] ^= 0xff;
    await writeFile(encryptedPath, encrypted);
    await assert.rejects(() => readPatientFile(storageKey));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("image processing strips metadata", async () => {
  process.env.FILE_AV_REQUIRED = "false";
  process.env.FILE_AV_COMMAND = "clinicnova-missing-test-scanner";
  const input = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#ffffff" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const prepared = await preparePatientUpload(input);
  const metadata = await sharp(prepared.bytes).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
});

test("readiness fails when mandatory antivirus is unavailable", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-readiness-test-"));
  process.env.FILE_STORAGE_ROOT = root;
  process.env.FILE_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64");
  process.env.FILE_AV_REQUIRED = "true";
  process.env.FILE_AV_COMMAND = "clinicnova-definitely-missing-scanner";
  try {
    await assert.rejects(() => assertFileSecurityReady(), /Antivirüs/);
  } finally {
    process.env.FILE_AV_REQUIRED = "false";
    await rm(root, { recursive: true, force: true });
  }
});
