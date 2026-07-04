import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const appPort = Number(process.env.CLINICNOVA_PORT ?? 3000);
const appHost = "127.0.0.1";
const publicHost = "localhost";
const appUrl = process.env.CLINICNOVA_WEBVIEW_URL ?? `http://${publicHost}:${appPort}/login`;
const staleAfterMs = Number(process.env.CLINICNOVA_WEBVIEW_STALE_MS ?? 120000);
const noTabTimeoutMs = Number(process.env.CLINICNOVA_WEBVIEW_NO_TAB_TIMEOUT_MS ?? 120000);
const closeGraceMs = Number(process.env.CLINICNOVA_WEBVIEW_CLOSE_GRACE_MS ?? 4500);

let nextProcess = null;
let lastHeartbeat = 0;
let hasSeenHeartbeat = false;
let shuttingDown = false;
let pendingCloseTimer = null;

function killPort(port) {
  try {
    const output = execFileSync("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], { encoding: "utf8" }).trim();
    if (!output) return;

    for (const rawPid of output.split(/\s+/)) {
      const pid = Number(rawPid);
      if (Number.isFinite(pid) && pid !== process.pid) {
        try {
          process.kill(pid, "SIGTERM");
          console.log(`[webview] Eski ${port} port süreci kapatıldı: ${pid}`);
        } catch {
          // Process may already be gone.
        }
      }
    }
  } catch {
    // lsof exits non-zero when the port is free.
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status < 500) return;
    } catch {
      // Server is still booting.
    }

    await wait(500);
  }

  throw new Error(`${url} zamanında hazır olmadı.`);
}

function openBrowser(url) {
  const chromeCandidates = [
    "/Applications/Google Chrome.app",
    "/Applications/Google Chrome Canary.app",
    "/Applications/Chromium.app",
    "/Applications/Microsoft Edge.app",
    "/Applications/Brave Browser.app"
  ];
  const chromiumApp = chromeCandidates.find((candidate) => existsSync(candidate));

  const args = chromiumApp
    ? ["-na", chromiumApp, "--args", `--app=${url}`, "--new-window"]
    : ["-n", url];

  const opener = spawn("open", args, {
    detached: true,
    stdio: "ignore"
  });
  opener.unref();
}

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[webview] ${reason}`);

  if (pendingCloseTimer) {
    clearTimeout(pendingCloseTimer);
    pendingCloseTimer = null;
  }

  if (nextProcess && !nextProcess.killed) {
    // detached:true ile başlatıldığı için tüm süreç grubunu öldür;
    // tek PID'e sinyal yollamak next-server'ı yetim bırakıyordu.
    killProcessTree(nextProcess, "SIGTERM");
    setTimeout(() => {
      if (nextProcess && !nextProcess.killed) {
        killProcessTree(nextProcess, "SIGKILL");
      }
      killPort(appPort);
    }, 2500).unref();
  }

  monitor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

function killProcessTree(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process may already be gone.
    }
  }
}

const monitor = http.createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url?.startsWith("/heartbeat")) {
    if (pendingCloseTimer) {
      clearTimeout(pendingCloseTimer);
      pendingCloseTimer = null;
    }
    lastHeartbeat = Date.now();
    hasSeenHeartbeat = true;
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url?.startsWith("/closing")) {
    response.writeHead(204);
    response.end();

    if (!hasSeenHeartbeat || pendingCloseTimer) return;

    pendingCloseTimer = setTimeout(() => {
      pendingCloseTimer = null;
      if (!shuttingDown && Date.now() - lastHeartbeat >= closeGraceMs) {
        shutdown("ClinicNova penceresi kapandı, arka plan kodu kapatılıyor.");
      }
    }, closeGraceMs);
    return;
  }

  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("ClinicNova webview monitor\n");
});

monitor.listen(0, "127.0.0.1", async () => {
  const address = monitor.address();
  if (!address || typeof address === "string") {
    throw new Error("Monitor portu alınamadı.");
  }

  const monitorUrl = `http://127.0.0.1:${address.port}`;
  killPort(appPort);
  await wait(600);

  console.log(`[webview] ClinicNova başlatılıyor: ${appUrl}`);
  console.log("[webview] ClinicNova penceresi kapanınca dev server otomatik kapanacak.");

  nextProcess = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", appHost, "--port", String(appPort)],
    {
      cwd: projectRoot,
      stdio: "inherit",
      detached: true,
      env: {
        ...process.env,
        NEXT_PUBLIC_WEBVIEW_MONITOR_URL: monitorUrl
      }
    }
  );

  nextProcess.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.log(`[webview] Next dev kapandı. code=${code ?? "null"} signal=${signal ?? "null"}`);
      monitor.close(() => process.exit(code ?? 0));
    }
  });

  try {
    await waitForUrl(`http://${appHost}:${appPort}/login`);
    openBrowser(appUrl);
  } catch (error) {
    shutdown(error instanceof Error ? error.message : "Uygulama açılamadı.");
  }
});

const startedAt = Date.now();
setInterval(() => {
  if (shuttingDown) return;

  if (hasSeenHeartbeat && Date.now() - lastHeartbeat > staleAfterMs) {
    shutdown("Açık ClinicNova sekmesi kalmadı, arka plan kodu kapatılıyor.");
  }

  if (!hasSeenHeartbeat && Date.now() - startedAt > noTabTimeoutMs) {
    shutdown("Sekme heartbeat göndermedi, arka plan kodu kapatılıyor.");
  }
}, 1000).unref();

process.on("SIGINT", () => shutdown("Ctrl+C alındı, kapatılıyor."));
process.on("SIGTERM", () => shutdown("SIGTERM alındı, kapatılıyor."));
