import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "mobile", "assets");
const releases = path.join(root, "releases");
const [html, css, mesh, app] = await Promise.all([
  readFile(path.join(assets, "index.html"), "utf8"),
  readFile(path.join(assets, "app.css"), "utf8"),
  readFile(path.join(assets, "mesh-sync.js"), "utf8"),
  readFile(path.join(assets, "app.js"), "utf8")
]);

const safeApp = app.replaceAll("</script", "<\\/script");
const safeMesh = mesh.replaceAll("</script", "<\\/script");
const configScript = 'window.CLINICNOVA_MOBILE_CONFIG = Object.freeze({ mode: "demo", serverUrl: "", autoOpenDemo: true });';
const scriptHash = (value) => createHash("sha256").update(value).digest("base64");
const bundled = html
  .replace(
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="default" />'
  )
  .replace('<link rel="stylesheet" href="app.css" />', () => `<style>${css}</style>`)
  .replace("script-src 'self'", `script-src 'sha256-${scriptHash(configScript)}' 'sha256-${scriptHash(safeMesh)}' 'sha256-${scriptHash(safeApp)}'`)
  // iOS Files/Quick Look may render local HTML before (or without) running
  // JavaScript. Make the useful screen the HTML default, not the login gate.
  .replace('<section id="loginScreen" class="login-screen">', '<section id="loginScreen" class="login-screen" hidden>')
  .replace('<div id="appShell" class="app-shell" hidden>', '<div id="appShell" class="app-shell">')
  .replace(
    '    <script src="runtime-config.js"></script>\n    <script src="mesh-sync.js"></script>\n    <script src="app.js"></script>',
    () => `    <script>${configScript}</script>\n    <script>${safeMesh}</script>\n    <script>${safeApp}</script>`
  );

await mkdir(releases, { recursive: true });
const output = path.join(releases, "ClinicNova-iPhone-Demo.html");
await writeFile(output, bundled, "utf8");
console.log(output);
