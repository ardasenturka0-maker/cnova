import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./build-ios-demo.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const htmlPath = path.join(root, "releases", "ClinicNova-iPhone-Demo.html");

await Promise.all([
  mkdir(path.join(dist, "server"), { recursive: true }),
  mkdir(path.join(dist, ".openai"), { recursive: true })
]);
await copyFile(htmlPath, path.join(dist, "index.html"));
await copyFile(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));

const html = await readFile(htmlPath, "utf8");
const worker = `const html = ${JSON.stringify(html)};

const workerApp = {
  async fetch() {
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer"
      }
    });
  }
};

export default workerApp;
`;
await writeFile(path.join(dist, "server", "index.js"), worker, "utf8");

console.log(path.join(dist, "index.html"));
