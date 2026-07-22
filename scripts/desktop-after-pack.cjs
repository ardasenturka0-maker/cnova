const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

async function removePlistKeyIfPresent(infoPlist, key) {
  try {
    await execFileAsync("plutil", ["-extract", key, "xml1", "-o", "-", infoPlist]);
  } catch {
    return;
  }
  await execFileAsync("plutil", ["-remove", key, infoPlist]);
}

module.exports = async function hardenDesktopBundle(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const infoPlist = path.join(context.appOutDir, appName, "Contents", "Info.plist");
  await execFileAsync("plutil", ["-replace", "NSAppTransportSecurity.NSAllowsArbitraryLoads", "-bool", "NO", infoPlist]);
  for (const key of [
    "NSAppTransportSecurity.NSExceptionDomains",
    "NSAudioCaptureUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription"
  ]) await removePlistKeyIfPresent(infoPlist, key);
};
