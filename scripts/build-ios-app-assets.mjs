import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const source = path.join(root, "mobile", "assets");
const output = path.join(root, "ios", "ClinicNova", "Resources");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["index.html", "app.css", "app.js", "mesh-sync.js"]) await cp(path.join(source, file), path.join(output, file));
await writeFile(path.join(output, "runtime-config.js"), `window.CLINICNOVA_MOBILE_CONFIG = Object.freeze(${JSON.stringify({ mode: "production", serverUrl: "", appVersion: version, platform: "ios", platformLabel: "iPhone / iPad" })});\n`, "utf8");
console.log(output);
