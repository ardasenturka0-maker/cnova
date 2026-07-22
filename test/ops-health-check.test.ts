import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

function runCheck(env: NodeJS.ProcessEnv) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/ops-health-check.ts"], { cwd: process.cwd(), env, stdio: "ignore" });
    child.once("error", reject); child.once("close", (code) => resolve(code ?? 1));
  });
}

test("ops monitoring deduplicates failures and sends one recovery event", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-ops-test-"));
  const backup = path.join(root, "backups", "base", "20260713T100000Z");
  const storage = path.join(root, "files");
  await mkdir(backup, { recursive: true }); await mkdir(storage);
  await writeFile(path.join(backup, "completed-at.txt"), new Date().toISOString());
  let ready = true; const events: string[] = [];
  const server = createServer((request, response) => {
    if (request.url === "/api/ready" && !ready) { response.statusCode = 503; response.end("no"); return; }
    if (request.url === "/alert") {
      let body = ""; request.on("data", (chunk) => { body += chunk; }); request.on("end", () => { events.push(JSON.parse(body).status); response.end("ok"); }); return;
    }
    response.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("test server açılamadı");
  const base = `http://127.0.0.1:${address.port}`;
  const env = { ...process.env, NEXT_PUBLIC_APP_URL: base, BACKUP_ROOT: path.join(root, "backups"), FILE_STORAGE_ROOT: storage, OPS_ALERT_WEBHOOK_URL: `${base}/alert`, OPS_ALERT_WEBHOOK_SECRET: "test-secret-at-least-32-characters-long", OPS_ALERT_STATE_FILE: path.join(root, "state.json"), OPS_ALERT_COOLDOWN_MINUTES: "60" };
  try {
    assert.equal(await runCheck(env), 0); assert.deepEqual(events, []);
    ready = false;
    assert.equal(await runCheck(env), 1); assert.deepEqual(events, ["alert"]);
    assert.equal(await runCheck(env), 1); assert.deepEqual(events, ["alert"]);
    ready = true;
    assert.equal(await runCheck(env), 0); assert.deepEqual(events, ["alert", "recovered"]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
