import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./build-ios-demo.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await mkdir(dist, { recursive: true });
await copyFile(
  path.join(root, "releases", "ClinicNova-iPhone-Demo.html"),
  path.join(dist, "index.html")
);

console.log(path.join(dist, "index.html"));
