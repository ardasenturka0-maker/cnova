import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = projectPackage.version;
const bonjourVersion = projectPackage.dependencies?.["bonjour-service"];
if (typeof bonjourVersion !== "string" || !bonjourVersion) throw new Error("bonjour-service üretim bağımlılığı package.json içinde tanımlı olmalıdır.");
const output = path.join(root, "desktop", "build");
const resources = path.join(root, "desktop", "build-resources");
const appDir = path.join(root, "desktop", "app");
const mobileAssets = ["index.html", "app.css", "app.js", "mesh-sync.js"];
const runtimePackages = new Set();

async function collectRuntimePackage(name) {
  if (runtimePackages.has(name)) return;
  const packageRoot = path.join(root, "node_modules", name);
  const metadata = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  runtimePackages.add(name);
  for (const dependency of Object.keys(metadata.dependencies || {})) await collectRuntimePackage(dependency);
}

await collectRuntimePackage("bonjour-service");
await rm(output, { recursive: true, force: true });
await rm(appDir, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(resources, { recursive: true });
await mkdir(path.join(appDir, "mobile"), { recursive: true });
await mkdir(path.join(appDir, "node_modules"), { recursive: true });
for (const file of mobileAssets) {
  await cp(path.join(root, "mobile", "assets", file), path.join(output, file));
}
await writeFile(
  path.join(output, "runtime-config.js"),
  `window.CLINICNOVA_MOBILE_CONFIG = Object.freeze(${JSON.stringify({ mode: "production", serverUrl: "", appVersion: version, platform: "desktop", platformLabel: "Masaüstü" })});\n`,
  "utf8"
);
await Promise.all([
  cp(path.join(root, "desktop", "main.cjs"), path.join(appDir, "main.cjs")),
  cp(path.join(root, "desktop", "mesh-transport.cjs"), path.join(appDir, "mesh-transport.cjs")),
  cp(path.join(root, "desktop", "native-policy.cjs"), path.join(appDir, "native-policy.cjs")),
  cp(path.join(root, "desktop", "preload.cjs"), path.join(appDir, "preload.cjs")),
  cp(path.join(root, "scripts", "desktop-after-pack.cjs"), path.join(appDir, "desktop-after-pack.cjs")),
  cp(output, path.join(appDir, "mobile"), { recursive: true }),
  ...[...runtimePackages].map(async (name) => {
    const destination = path.join(appDir, "node_modules", name);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(root, "node_modules", name), destination, { recursive: true });
  }),
  writeFile(path.join(appDir, "package.json"), `${JSON.stringify({
    name: "clinicnova-desktop",
    version,
    private: true,
    description: "ClinicNova local-first desktop client",
    author: "ClinicNova",
    main: "main.cjs",
    dependencies: { "bonjour-service": bonjourVersion }
  }, null, 2)}\n`, "utf8")
]);
await sharp(path.join(root, "src", "app", "icon.svg")).resize(1024, 1024).png().toFile(path.join(resources, "icon.png"));
console.log(output);
