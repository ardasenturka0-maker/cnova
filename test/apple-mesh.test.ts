import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("iOS is a real native local-first client, not the HTML preview", async () => {
  const [view, transport, store, plist, project, build] = await Promise.all([
    readFile("ios/ClinicNova/ViewController.swift", "utf8"),
    readFile("ios/ClinicNova/MeshTransport.swift", "utf8"),
    readFile("ios/ClinicNova/SecureMeshStore.swift", "utf8"),
    readFile("ios/ClinicNova/Info.plist", "utf8"),
    readFile("ios/ClinicNova.xcodeproj/project.pbxproj", "utf8"),
    readFile("scripts/build-ios-app.sh", "utf8")
  ]);
  assert.match(view, /WKWebView/);
  assert.match(view, /ClinicNovaMeshEnvelope/);
  assert.match(view, /meshGetConfig/);
  assert.match(transport, /_clinicnova\._tcp\./);
  assert.match(transport, /AES\.GCM/);
  assert.match(transport, /HMAC<SHA256>/);
  assert.match(transport, /SO_NOSIGPIPE/);
  assert.match(transport, /maximumFrame = 64 \* 1024 \* 1024/);
  assert.doesNotMatch(transport, /SO_BROADCAST|INADDR_BROADCAST/);
  assert.match(store, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(store, /completeFileProtection/);
  assert.match(plist, /NSLocalNetworkUsageDescription/);
  assert.match(plist, /NSBonjourServices/);
  assert.match(project, /MeshTransport\.swift in Sources/);
  assert.match(project, /mesh-sync\.js in Resources/);
  assert.match(build, /xcodebuild/);
  assert.match(build, /APPLE_DEVELOPMENT_TEAM/);
});

test("Android, iOS, Windows and macOS advertise the same authenticated service", async () => {
  const [android, ios, desktop, builder] = await Promise.all([
    readFile("mobile/src/app/clinicnova/mobile/MeshTransport.java", "utf8"),
    readFile("ios/ClinicNova/MeshTransport.swift", "utf8"),
    readFile("desktop/mesh-transport.cjs", "utf8"),
    readFile("electron-builder.yml", "utf8")
  ]);
  for (const source of [android, ios, desktop]) {
    assert.match(source, /clinicnova/);
    assert.match(source, /HmacSHA256|HMAC<SHA256>|createHmac\("sha256"/);
    assert.match(source, /AES\/GCM\/NoPadding|AES\.GCM|aes-256-gcm/);
  }
  assert.match(android, /NsdManager/);
  assert.match(desktop, /bonjour-service/);
  assert.match(builder, /NSBonjourServices/);
  assert.match(builder, /NSLocalNetworkUsageDescription/);
});
