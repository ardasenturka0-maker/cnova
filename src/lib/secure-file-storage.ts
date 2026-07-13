import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const HEADER = Buffer.from("CNV1");
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2560;

export type PreparedUpload = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
  checksumSha256: string;
};

function storageRoot() {
  return path.resolve(process.env.FILE_STORAGE_ROOT || path.join(process.cwd(), "var", "patient-files"));
}

function encryptionKey() {
  const configured = process.env.FILE_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32) throw new Error("FILE_ENCRYPTION_KEY 32 baytlık base64 anahtar olmalı.");
    return decoded;
  }
  if (process.env.NODE_ENV === "production") throw new Error("FILE_ENCRYPTION_KEY yapılandırılmadı.");
  return createHash("sha256").update(process.env.AUTH_SECRET || "clinicnova-development-file-key").digest();
}

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function absoluteStoragePath(storageKey: string) {
  const root = storageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Geçersiz dosya anahtarı.");
  return resolved;
}

function detectMime(bytes: Buffer) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { mimeType: "image/jpeg", extension: "jpg" };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: "image/png", extension: "png" };
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return { mimeType: "application/pdf", extension: "pdf" };
  const brand = bytes.subarray(8, 12).toString("ascii");
  if (bytes.subarray(4, 8).toString("ascii") === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
    return { mimeType: "image/heic", extension: "heic" };
  }
  throw new Error("Dosya içeriği desteklenen JPG, PNG, WebP, HEIC veya PDF biçimlerinden biri değil.");
}

async function scanForMalware(bytes: Buffer) {
  const required = process.env.FILE_AV_REQUIRED === "true" || process.env.NODE_ENV === "production";
  const command = process.env.FILE_AV_COMMAND || "clamscan";
  const tempDirectory = path.join(tmpdir(), `clinicnova-scan-${randomUUID()}`);
  const tempFile = path.join(tempDirectory, "upload.bin");
  await mkdir(tempDirectory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(tempFile, bytes, { mode: 0o600 });
    const result = await new Promise<{ code: number | null; error?: NodeJS.ErrnoException }>((resolve) => {
      const child = spawn(command, ["--no-summary", tempFile], { stdio: "ignore", shell: false });
      child.once("error", (error: NodeJS.ErrnoException) => resolve({ code: null, error }));
      child.once("close", (code) => resolve({ code }));
    });
    if (result.error?.code === "ENOENT" && !required) return;
    if (result.error) throw new Error("Antivirüs tarayıcısı çalıştırılamadı.");
    if (result.code === 1) throw new Error("Dosya antivirüs taramasından geçemedi.");
    if (result.code !== 0) throw new Error("Antivirüs taraması tamamlanamadı.");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function preparePatientUpload(input: Buffer): Promise<PreparedUpload> {
  if (input.length === 0) throw new Error("Dosya boş.");
  if (input.length > MAX_FILE_SIZE) throw new Error("Dosya 15 MB sınırını aşıyor.");
  const detected = detectMime(input);
  await scanForMalware(input);

  let bytes = input;
  let mimeType = detected.mimeType;
  let extension = detected.extension;
  if (detected.mimeType.startsWith("image/")) {
    const image = sharp(input, { failOn: "warning", limitInputPixels: 40_000_000 }).rotate().resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true
    });
    if (detected.mimeType === "image/png") bytes = await image.png({ compressionLevel: 9 }).toBuffer();
    else if (detected.mimeType === "image/webp") bytes = await image.webp({ quality: 84 }).toBuffer();
    else {
      bytes = await image.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
      mimeType = "image/jpeg";
      extension = "jpg";
    }
  }

  return { bytes, mimeType, extension, checksumSha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function storePatientFile(organizationId: string, patientId: string, prepared: PreparedUpload) {
  const storageKey = path.join(safePart(organizationId), safePart(patientId), `${randomUUID()}.${prepared.extension}.enc`);
  const destination = absoluteStoragePath(storageKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(prepared.bytes), cipher.final()]);
  const payload = Buffer.concat([HEADER, iv, cipher.getAuthTag(), encrypted]);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, payload, { mode: 0o600 });
  await rename(temporary, destination);
  return storageKey;
}

export async function readPatientFile(storageKey: string, expectedChecksum?: string | null) {
  const payload = await readFile(absoluteStoragePath(storageKey));
  if (!payload.subarray(0, 4).equals(HEADER) || payload.length < 33) throw new Error("Dosya kasası kaydı geçersiz.");
  const iv = payload.subarray(4, 16);
  const tag = payload.subarray(16, 32);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const bytes = Buffer.concat([decipher.update(payload.subarray(32)), decipher.final()]);
  if (expectedChecksum && createHash("sha256").update(bytes).digest("hex") !== expectedChecksum) throw new Error("Dosya bütünlük kontrolü başarısız.");
  return bytes;
}

export async function deleteStoredPatientFile(storageKey: string | null | undefined) {
  if (!storageKey) return;
  await rm(absoluteStoragePath(storageKey), { force: true });
}

export async function assertFileStorageReady() {
  const root = storageRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await access(root, constants.R_OK | constants.W_OK);
  encryptionKey();
  return root;
}
