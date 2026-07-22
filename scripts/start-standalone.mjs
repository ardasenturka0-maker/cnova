import { cpSync, existsSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

function readServerArguments(args) {
  let port;
  let hostname;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const separator = argument.indexOf("=");
    const name = separator === -1 ? argument : argument.slice(0, separator);
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1);
    const isPort = name === "--port" || name === "-p";
    const isHostname = name === "--hostname" || name === "-H";
    if (!isPort && !isHostname) throw new Error(`Bilinmeyen başlatma seçeneği: ${argument}`);

    const value = inlineValue ?? args[index + 1];
    if (!value || (inlineValue === undefined && value.startsWith("-"))) {
      throw new Error(`${name} için bir değer girin.`);
    }
    if (inlineValue === undefined) index += 1;
    if (isPort) port = value;
    if (isHostname) hostname = value;
  }

  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65_535)) {
    throw new Error("Port 1 ile 65535 arasında olmalıdır.");
  }

  return { port, hostname };
}

let serverArguments;
try {
  serverArguments = readServerArguments(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Başlatma seçenekleri geçersiz.");
  process.exit(1);
}

if (serverArguments.port) process.env.PORT = serverArguments.port;
if (serverArguments.hostname) process.env.HOSTNAME = serverArguments.hostname;

const buildRoot = resolve(".next");
const standaloneRoot = resolve(buildRoot, "standalone");
const serverEntry = resolve(standaloneRoot, "server.js");

if (!existsSync(serverEntry)) {
  console.error("Standalone üretim çıktısı bulunamadı. Önce `npm run build` çalıştırın.");
  process.exit(1);
}

const staticSource = resolve(buildRoot, "static");
if (existsSync(staticSource)) {
  const staticTarget = resolve(standaloneRoot, ".next", "static");
  mkdirSync(resolve(standaloneRoot, ".next"), { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true, force: true });
}

const publicSource = resolve("public");
if (existsSync(publicSource)) {
  cpSync(publicSource, resolve(standaloneRoot, "public"), { recursive: true, force: true });
}

process.env.NODE_ENV = "production";
process.env.TZ ??= "Europe/Istanbul";
await import(pathToFileURL(serverEntry).href);
