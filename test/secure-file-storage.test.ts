import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { deleteStoredPatientFile, preparePatientUpload, readPatientFile, storePatientFile } from "../src/lib/secure-file-storage";

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
    assert.equal(encrypted.subarray(0, 4).toString(), "CNV1");
    assert.notDeepEqual(encrypted.subarray(32), prepared.bytes);
    assert.deepEqual(await readPatientFile(storageKey, prepared.checksumSha256), prepared.bytes);
    await deleteStoredPatientFile(storageKey);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file type is read from its signature, not the browser MIME claim", async () => {
  await assert.rejects(() => preparePatientUpload(Buffer.from("not really a jpeg")), /Dosya içeriği/);
});
