import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, statfs, writeFile } from "node:fs/promises";
import path from "node:path";

type Check = { name: string; ok: boolean; detail: string };

async function endpoint(name: string, url: string): Promise<Check> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "ClinicNova-Ops/1" } });
    return { name, ok: response.ok, detail: `HTTP ${response.status}` };
  } catch (error) { return { name, ok: false, detail: error instanceof Error ? error.message : "erişilemedi" }; }
}

async function backupAge(): Promise<Check> {
  const root = process.env.BACKUP_ROOT;
  if (!root) return { name: "backup", ok: false, detail: "BACKUP_ROOT ayarlı değil" };
  try {
    const folders = (await readdir(path.join(root, "base"))).sort();
    const latest = folders.at(-1);
    if (!latest) throw new Error("yedek bulunamadı");
    const completed = new Date(await readFile(path.join(root, "base", latest, "completed-at.txt"), "utf8")).getTime();
    const hours = (Date.now() - completed) / 3_600_000;
    if (!Number.isFinite(hours) || hours < -0.1) return { name: "backup", ok: false, detail: "yedek zamanı geçersiz veya gelecekte" };
    return { name: "backup", ok: hours <= Number(process.env.BACKUP_MAX_AGE_HOURS ?? 30), detail: `son yedek ${hours.toFixed(1)} saat önce` };
  } catch (error) { return { name: "backup", ok: false, detail: error instanceof Error ? error.message : "okunamadı" }; }
}

async function disk(): Promise<Check> {
  try {
    const stats = await statfs(process.env.FILE_STORAGE_ROOT ?? "/");
    const used = 100 - Math.floor(Number(stats.bavail) * 100 / Number(stats.blocks));
    const limit = Number(process.env.DISK_ALERT_PERCENT ?? 85);
    return { name: "disk", ok: used < limit, detail: `%${used} kullanım (eşik %${limit})` };
  } catch (error) { return { name: "disk", ok: false, detail: error instanceof Error ? error.message : "ölçülemedi" }; }
}

async function notify(status: "alert" | "recovered", checks: Check[]) {
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  const secret = process.env.OPS_ALERT_WEBHOOK_SECRET;
  if (!url || !secret) throw new Error("OPS_ALERT_WEBHOOK_URL ve OPS_ALERT_WEBHOOK_SECRET gerekli.");
  const body = JSON.stringify({ service: "clinicnova", status, checks: checks.filter((item) => !item.ok), timestamp: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-ClinicNova-Signature": `sha256=${signature}` }, body, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Alarm webhook HTTP ${response.status}`);
}

type AlertState = { fingerprint: string; lastSentAt: string };
const stateFile = process.env.OPS_ALERT_STATE_FILE ?? "/var/lib/clinicnova/ops-alert-state.json";
async function readState(): Promise<AlertState | null> {
  try { return JSON.parse(await readFile(stateFile, "utf8")) as AlertState; } catch { return null; }
}
async function writeState(state: AlertState) {
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const temporary = `${stateFile}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
  await rename(temporary, stateFile);
}

async function main() {
  const baseUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  const checks = await Promise.all([endpoint("health", new URL("/api/health", baseUrl).href), endpoint("ready", new URL("/api/ready", baseUrl).href), backupAge(), disk()]);
  for (const check of checks) console.log(`${check.ok ? "✓" : "×"} ${check.name}: ${check.detail}`);
  const failed = checks.filter((item) => !item.ok);
  const fingerprint = failed.length ? createHash("sha256").update(failed.map((item) => item.name).sort().join("|")).digest("hex") : "healthy";
  const previous = await readState();
  const cooldownMs = Number(process.env.OPS_ALERT_COOLDOWN_MINUTES ?? 60) * 60_000;
  const lastSent = previous ? new Date(previous.lastSentAt).getTime() : 0;
  if (failed.length && (previous?.fingerprint !== fingerprint || !Number.isFinite(lastSent) || Date.now() - lastSent >= cooldownMs)) {
    await notify("alert", checks);
    await writeState({ fingerprint, lastSentAt: new Date().toISOString() });
  } else if (!failed.length && previous && previous.fingerprint !== "healthy") {
    await notify("recovered", checks);
    await writeState({ fingerprint, lastSentAt: new Date().toISOString() });
  } else if (!previous) await writeState({ fingerprint, lastSentAt: new Date().toISOString() });
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
