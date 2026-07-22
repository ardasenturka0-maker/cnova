import { writeFile } from "node:fs/promises";

const [outputPath, mode = "production", serverUrl = "", appVersion = "0.0.0", platform = "android", platformLabel = "Android"] = process.argv.slice(2);
if (!outputPath) throw new Error("Runtime config output path is required.");
if (!new Set(["production", "demo"]).has(mode)) throw new Error("MOBILE_MODE production veya demo olmalı.");

let normalizedUrl = "";
if (serverUrl) {
  const parsed = new URL(serverUrl);
  if (parsed.protocol !== "https:") throw new Error("MOBILE_SERVER_URL HTTPS olmalı.");
  parsed.search = "";
  parsed.hash = "";
  normalizedUrl = parsed.href.replace(/\/$/, "");
}

const config = { mode, serverUrl: normalizedUrl, appVersion, platform, platformLabel };
await writeFile(outputPath, `window.CLINICNOVA_MOBILE_CONFIG = Object.freeze(${JSON.stringify(config)});\n`, "utf8");
