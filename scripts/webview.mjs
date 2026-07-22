import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

function boundedNumber(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${name} geçerli bir sayı olmalıdır.`);
  return value;
}

const appPort = boundedNumber("CLINICNOVA_PORT", 3000, 1, 65535);
if (!Number.isInteger(appPort)) throw new Error("CLINICNOVA_PORT tam sayı olmalıdır.");
const appHost = "127.0.0.1";
const publicHost = "localhost";
const defaultAppUrl = `http://${publicHost}:${appPort}/login`;
const appUrl = (() => {
  const parsed = new URL(process.env.CLINICNOVA_WEBVIEW_URL ?? defaultAppUrl);
  if (parsed.protocol !== "http:" || ![publicHost, appHost].includes(parsed.hostname) || Number(parsed.port || 80) !== appPort || parsed.username || parsed.password) {
    throw new Error("CLINICNOVA_WEBVIEW_URL yalnız bu bilgisayardaki ClinicNova adresini kullanmalıdır.");
  }
  return parsed.href;
})();
const staleAfterMs = boundedNumber("CLINICNOVA_WEBVIEW_STALE_MS", 120000, 10_000, 24 * 60 * 60_000);
const noTabTimeoutMs = boundedNumber("CLINICNOVA_WEBVIEW_NO_TAB_TIMEOUT_MS", 120000, 10_000, 24 * 60 * 60_000);
const closeGraceMs = boundedNumber("CLINICNOVA_WEBVIEW_CLOSE_GRACE_MS", 4500, 1000, 60_000);

let nextProcess = null;
let nextExited = false;
let lastHeartbeat = 0;
let hasSeenHeartbeat = false;
let shuttingDown = false;
let pendingCloseTimer = null;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assertPortAvailable(host, port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", error => reject(error.code === "EADDRINUSE" ? new Error(`${port} portu başka bir süreç tarafından kullanılıyor. CLINICNOVA_PORT ile boş bir port seçin.`) : error));
    probe.listen(port, host, () => probe.close(resolve));
  });
}

async function waitForUrl(url, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (nextExited) throw new Error("ClinicNova geliştirme sunucusu hazır olmadan kapandı.");
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "manual" });
      if (response.status > 0 && response.status < 500) return;
    } catch { /* Server is still booting. */ }
    await wait(500);
  }
  throw new Error(`${url} zamanında hazır olmadı.`);
}

function launchDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", error => console.error(`[webview] Pencere açılamadı: ${error.message}`));
  child.unref();
}

function openBrowser(url) {
  const profileDir = path.join(os.tmpdir(), "clinicnova-webview-profile");
  if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app",
      "/Applications/Google Chrome Canary.app",
      "/Applications/Chromium.app",
      "/Applications/Microsoft Edge.app",
      "/Applications/Brave Browser.app"
    ];
    const chromiumApp = candidates.find(candidate => existsSync(candidate));
    if (chromiumApp) launchDetached("open", ["-na", chromiumApp, "--args", `--app=${url}`, "--new-window", `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check"]);
    else launchDetached("open", ["-n", url]);
    return;
  }
  if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    const candidates = roots.flatMap(root => [
      path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
    ]);
    const chromium = candidates.find(candidate => existsSync(candidate));
    if (chromium) launchDetached(chromium, [`--app=${url}`, "--new-window", `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check"]);
    else launchDetached("explorer.exe", [url]);
    return;
  }
  launchDetached("xdg-open", [url]);
}

function killProcessTree(child, force) {
  if (!child?.pid || nextExited) return;
  if (process.platform === "win32") {
    const args = ["/PID", String(child.pid), "/T"];
    if (force) args.push("/F");
    const killer = spawn("taskkill.exe", args, { stdio: "ignore", windowsHide: true });
    killer.on("error", () => { try { child.kill(); } catch { /* Process already exited. */ } });
    return;
  }
  try { process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM"); }
  catch { try { child.kill(force ? "SIGKILL" : "SIGTERM"); } catch { /* Process already exited. */ } }
}

function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[webview] ${reason}`);
  if (pendingCloseTimer) { clearTimeout(pendingCloseTimer); pendingCloseTimer = null; }
  if (nextProcess && !nextExited) {
    killProcessTree(nextProcess, false);
    setTimeout(() => killProcessTree(nextProcess, true), 2500).unref();
  }
  monitor.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 3500).unref();
}

const monitorToken = randomBytes(24).toString("base64url");
const monitorPrefix = `/${monitorToken}`;
const allowedOrigins = new Set([`http://${publicHost}:${appPort}`, `http://${appHost}:${appPort}`]);
const monitor = http.createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const origin = request.headers.origin || "";
  if (allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Vary", "Origin");
  }
  let pathname = "";
  try { pathname = new URL(request.url || "/", "http://127.0.0.1").pathname; } catch { /* Return a generic rejection below. */ }
  const heartbeatPath = `${monitorPrefix}/heartbeat`;
  const closingPath = `${monitorPrefix}/closing`;
  if (request.method === "OPTIONS") {
    response.writeHead(allowedOrigins.has(origin) && [heartbeatPath, closingPath].includes(pathname) ? 204 : 403);
    response.end(); return;
  }
  if (request.method !== "POST" || !allowedOrigins.has(origin)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" }); response.end("Forbidden\n"); return;
  }
  if (pathname === heartbeatPath) {
    if (pendingCloseTimer) { clearTimeout(pendingCloseTimer); pendingCloseTimer = null; }
    lastHeartbeat = Date.now(); hasSeenHeartbeat = true;
    response.writeHead(204); response.end(); return;
  }
  if (pathname === closingPath) {
    response.writeHead(204); response.end();
    if (!hasSeenHeartbeat || pendingCloseTimer) return;
    pendingCloseTimer = setTimeout(() => {
      pendingCloseTimer = null;
      if (!shuttingDown && Date.now() - lastHeartbeat >= closeGraceMs) shutdown("ClinicNova penceresi kapandı, arka plan kodu kapatılıyor.");
    }, closeGraceMs);
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); response.end("Not found\n");
});

monitor.on("error", error => {
  console.error(`[webview] İzleyici başlatılamadı: ${error.message}`);
  if (!shuttingDown) process.exit(1);
});

monitor.listen(0, appHost, async () => {
  const address = monitor.address();
  if (!address || typeof address === "string") return shutdown("Monitor portu alınamadı.", 1);
  const monitorUrl = `http://${appHost}:${address.port}${monitorPrefix}`;
  try { await assertPortAvailable(appHost, appPort); }
  catch (error) { return shutdown(error instanceof Error ? error.message : "Uygulama portu kullanılamıyor.", 1); }

  console.log(`[webview] ClinicNova başlatılıyor: ${appUrl}`);
  console.log("[webview] ClinicNova penceresi kapanınca geliştirme sunucusu otomatik kapanacak.");
  nextProcess = spawn(process.execPath, [nextBin, "dev", "--hostname", appHost, "--port", String(appPort)], {
    cwd: projectRoot,
    stdio: "inherit",
    detached: true,
    env: { ...process.env, NEXT_PUBLIC_WEBVIEW_MONITOR_URL: monitorUrl }
  });
  nextProcess.once("error", error => shutdown(`Geliştirme sunucusu başlatılamadı: ${error.message}`, 1));
  nextProcess.on("exit", (code, signal) => {
    nextExited = true;
    if (!shuttingDown) {
      console.log(`[webview] Next dev kapandı. code=${code ?? "null"} signal=${signal ?? "null"}`);
      monitor.close(() => process.exit(code ?? 1));
    }
  });
  try {
    await waitForUrl(`http://${appHost}:${appPort}/login`);
    openBrowser(appUrl);
  } catch (error) {
    shutdown(error instanceof Error ? error.message : "Uygulama açılamadı.", 1);
  }
});

const startedAt = Date.now();
setInterval(() => {
  if (shuttingDown) return;
  if (hasSeenHeartbeat && Date.now() - lastHeartbeat > staleAfterMs) shutdown("Açık ClinicNova sekmesi kalmadı, arka plan kodu kapatılıyor.");
  if (!hasSeenHeartbeat && Date.now() - startedAt > noTabTimeoutMs) shutdown("Sekme heartbeat göndermedi, arka plan kodu kapatılıyor.");
}, 1000).unref();

process.on("SIGINT", () => shutdown("Ctrl+C alındı, kapatılıyor."));
process.on("SIGTERM", () => shutdown("SIGTERM alındı, kapatılıyor."));
