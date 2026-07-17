import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const version = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const output = path.join(root, "desktop", "build");
const resources = path.join(root, "desktop", "build-resources");
const appDir = path.join(root, "desktop", "app");
await rm(output, { recursive: true, force: true });
await rm(appDir, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(resources, { recursive: true });
await mkdir(path.join(appDir, "mobile"), { recursive: true });
for (const file of ["index.html", "app.css", "app.js", "mesh-sync.js"]) {
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
  cp(path.join(root, "desktop", "preload.cjs"), path.join(appDir, "preload.cjs")),
  cp(output, path.join(appDir, "mobile"), { recursive: true }),
  writeFile(path.join(appDir, "package.json"), `${JSON.stringify({ name: "clinicnova-desktop", version, private: true, description: "ClinicNova local-first desktop client", author: "ClinicNova", main: "main.cjs" }, null, 2)}\n`, "utf8"),
  writeFile(path.join(appDir, "package-lock.json"), `${JSON.stringify({ name: "clinicnova-desktop", version, lockfileVersion: 3, requires: true, packages: { "": { name: "clinicnova-desktop", version } } }, null, 2)}\n`, "utf8")
]);
await sharp(path.join(root, "src", "app", "icon.svg")).resize(1024, 1024).png().toFile(path.join(resources, "icon.png"));
console.log(output);
