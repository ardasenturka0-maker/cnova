import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop renderer is sandboxed and native bridges are limited to packaged content", async () => {
  const [main, preload] = await Promise.all([
    readFile("desktop/main.cjs", "utf8"),
    readFile("desktop/preload.cjs", "utf8")
  ]);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /app\.enableSandbox\(\)/);
  assert.match(main, /safeStorage\.encryptString/);
  assert.match(main, /isLocalAppDocument\(event\.senderFrame\.url\)/);
  assert.match(main, /event\.senderFrame === event\.sender\.mainFrame/);
  assert.match(main, /clinicnova:\/\/app/);
  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /webviewTag:\s*false/);
  assert.match(main, /devTools:\s*!app\.isPackaged/);
  assert.match(main, /navigateOnDragDrop:\s*false/);
  assert.match(main, /appendSwitch\("disable-http-cache"\)/);
  assert.match(main, /removeSwitch\("remote-debugging-port"\)/);
  assert.match(main, /session\.defaultSession\.clearCache\(\)/);
  assert.match(main, /"serviceworkers", "cachestorage", "shadercache"/);
  assert.match(main, /will-attach-webview/);
  assert.match(main, /webContents\.on\("will-redirect"/);
  assert.match(main, /classifyMainFrameRedirect/);
  assert.match(main, /const decision = classifyMainFrameRedirect\(target\.href/);
  assert.match(main, /if \(decision === "allow-server"\) return;[\s\S]*event\.preventDefault\(\);[\s\S]*returnToLocalApp\(window, "offline=1"\)/);
  assert.match(main, /permission === "notifications"[\s\S]*isLocalAppDocument/);
  assert.match(main, /permission !== "media"[\s\S]*type !== "video"/);
  assert.match(preload, /window\.location\.protocol === "clinicnova:"/);
  assert.match(preload, /window\.location\.hostname === "app"/);
  assert.match(preload, /"\/index\.html"/);
  assert.doesNotMatch(preload, /send:\s*ipcRenderer\.send/);
});

test("desktop exposes every native capability used by the shared mobile bundle", async () => {
  const [mobile, preload, main] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("desktop/preload.cjs", "utf8"),
    readFile("desktop/main.cjs", "utf8")
  ]);
  assert.match(mobile, /ClinicNovaNative\?\.storage\?\.getItem/);
  assert.match(mobile, /ClinicNovaNative\.storage\.setItem/);
  assert.match(mobile, /ClinicNovaNative\?\.onSyncResult/);
  assert.match(mobile, /ClinicNovaNative\?\.onProductSearchResult/);
  for (const capability of ["hashSecret", "connect", "openPortal", "sync", "productSearch", "requestNotificationPermission", "showLocalNotification", "meshGetConfig", "meshGetEnvelope", "meshConfigure", "meshPublish", "meshSyncNow", "meshDisable"]) {
    assert.match(preload, new RegExp(`${capability}\\(`), `desktop preload is missing ${capability}`);
  }
  assert.match(main, /clinicnova:product-search-result/);
  assert.match(main, /new Notification/);
});

test("desktop packaging includes native policy, LAN transport, auth assets and hardened fuses", async () => {
  const [buildScript, afterPack, builder, packageJson] = await Promise.all([
    readFile("scripts/build-desktop-assets.mjs", "utf8"),
    readFile("scripts/desktop-after-pack.cjs", "utf8"),
    readFile("electron-builder.yml", "utf8"),
    readFile("package.json", "utf8")
  ]);
  assert.match(buildScript, /mesh-transport\.cjs/);
  assert.match(buildScript, /native-policy\.cjs/);
  assert.match(buildScript, /collectRuntimePackage\("bonjour-service"\)/);
  assert.match(buildScript, /index\.html/);
  assert.match(buildScript, /app\.css/);
  assert.match(buildScript, /app\.js/);
  assert.match(builder, /enableCookieEncryption:\s*true/);
  assert.match(builder, /enableEmbeddedAsarIntegrityValidation:\s*true/);
  assert.match(builder, /onlyLoadAppFromAsar:\s*true/);
  assert.match(builder, /runAsNode:\s*false/);
  assert.match(builder, /resetAdHocDarwinSignature:\s*true/);
  assert.match(builder, /signIgnore:[\s\S]*asar\|bin\|icns\|pak/);
  assert.match(builder, /NSAllowsArbitraryLoads:\s*false/);
  assert.match(builder, /afterPack:\s*desktop\/app\/desktop-after-pack\.cjs/);
  assert.match(builder, /!desktop-after-pack\.cjs/);
  assert.match(buildScript, /desktop-after-pack\.cjs/);
  assert.match(afterPack, /NSAppTransportSecurity\.NSAllowsArbitraryLoads/);
  assert.match(afterPack, /"-bool", "NO"/);
  assert.match(afterPack, /NSAppTransportSecurity\.NSExceptionDomains/);
  assert.match(afterPack, /NSMicrophoneUsageDescription/);
  assert.match(afterPack, /NSBluetoothAlwaysUsageDescription/);
  assert.match(afterPack, /removePlistKeyIfPresent/);
  const electronVersion = builder.match(/electronVersion:\s*([^\s]+)/)?.[1];
  assert.equal(electronVersion, JSON.parse(packageJson).devDependencies.electron.replace(/^\^/, ""));
});

test("local-first clients push pending changes and pull a server snapshot", async () => {
  const [mobile, route] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("src/app/api/mobile/sync/route.ts", "utf8")
  ]);
  assert.match(mobile, /function applyServerSnapshot\(snapshot\)/);
  assert.match(mobile, /operations = syncQueue\.filter\(\(item\) => canSyncEntity\(item\.entityType\)\)\.slice\(0, 50\)/);
  assert.match(mobile, /applyServerSnapshot\(response\.snapshot\)/);
  assert.match(route, /getMobileSnapshot\(session, batch\.deviceId\)/);
});

test("online synchronization is bounded, times out, and preserves malformed responses for retry", async () => {
  const [mobile, desktop, android] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("desktop/main.cjs", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8")
  ]);
  assert.match(mobile, /syncRequestTimer = setTimeout/);
  assert.match(mobile, /Sunucudan eksik veya bozuk eşitleme yanıtı geldi/);
  assert.match(desktop, /controller\.abort\(\)/);
  assert.match(desktop, /async function readResponseLimited/);
  assert.match(desktop, /await reader\.cancel\(\)/);
  assert.match(desktop, /64 \* 1024 \* 1024/);
  assert.match(desktop, /redirect:\s*"manual"/);
  assert.match(desktop, /configuredServerOrigin\(serverUrl\)/);
  assert.doesNotMatch(desktop, /\.slice\(0, 1024 \* 1024\)/);
  assert.match(android, /readUtf8Limited\(stream, MAX_SYNC_RESPONSE_BYTES\)/);
  assert.match(android, /MAX_SYNC_RESPONSE_BYTES = 64 \* 1024 \* 1024/);
});

test("offline persistence failures are surfaced and partial mesh setup is rolled back", async () => {
  const [mobile, desktop] = await Promise.all([readFile("mobile/assets/app.js", "utf8"), readFile("desktop/main.cjs", "utf8")]);
  assert.match(mobile, /return window\.ClinicNovaNative\.storage\.setItem\(key, serialized\) !== false/);
  assert.match(mobile, /Cihaz depolamasına yazılamadı/);
  assert.match(mobile, /if \(!persistMesh\(\)\) throw new Error/);
  assert.match(mobile, /if \(configuredNative\)/);
  assert.match(mobile, /if \(nativeConfigBefore\)/);
  assert.match(mobile, /meshDisable\?\.\(\)/);
  assert.match(mobile, /meshConfig = previousConfig; meshEngine = previousEngine/);
  assert.match(desktop, /const nextStore = \{ \.\.\.encryptedStore/);
  assert.match(desktop, /persistStore\(nextStore\); encryptedStore = nextStore/);
  assert.match(desktop, /previousConfig = meshTransport\.config \? \{ \.\.\.meshTransport\.config, secret: meshTransport\.config\.secret\.toString\("base64"\) \}/);
});

test("offline clinic login stores only a derived password and supports Android native PBKDF2", async () => {
  const [mobile, android] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8")
  ]);
  assert.match(mobile, /PBKDF2/);
  assert.match(mobile, /passwordHash/);
  assert.match(mobile, /recoveryHash/);
  assert.match(mobile, /failures >= 5/);
  assert.doesNotMatch(mobile, /localAccount[^\n]*password:/);
  assert.match(android, /PBKDF2WithHmacSHA256/);
  assert.match(android, /spec\.clearPassword\(\)/);
});

test("Android authenticates in its own cookie jar and removes native bridges from remote pages", async () => {
  const [mobile, android] = await Promise.all([
    readFile("mobile/assets/app.js", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8")
  ]);
  assert.match(mobile, /ClinicNovaNative\?\.connect/);
  assert.match(mobile, /ClinicNovaNative\?\.openPortal/);
  assert.match(android, /validatedServerUrl/);
  assert.match(android, /trustedOrigin\.equals\(originOf\(uri\)\)/);
  assert.match(android, /removeJavascriptInterface\("ClinicNovaNative"\)/);
  assert.match(android, /setAcceptThirdPartyCookies\(webView, false\)/);
  assert.match(android, /MIXED_CONTENT_NEVER_ALLOW/);
});

test("LAN mesh transport is authenticated, encrypted, bounded, and native-only", async () => {
  const [transport, main, preload, android, androidActivity, manifest] = await Promise.all([
    readFile("desktop/mesh-transport.cjs", "utf8"),
    readFile("desktop/main.cjs", "utf8"),
    readFile("desktop/preload.cjs", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MeshTransport.java", "utf8"),
    readFile("mobile/src/app/clinicnova/mobile/MainActivity.java", "utf8"),
    readFile("mobile/AndroidManifest.xml", "utf8")
  ]);
  assert.match(transport, /aes-256-gcm/);
  assert.match(transport, /createHmac\("sha256"/);
  assert.match(transport, /timingSafeEqual/);
  assert.match(transport, /MAX_FRAME = 64 \* 1024 \* 1024/);
  assert.match(transport, /MAX_ENVELOPE = 47 \* 1024 \* 1024/);
  assert.match(transport, /server\.maxConnections = 4/);
  assert.match(android, /AES\/GCM\/NoPadding/);
  assert.match(androidActivity, /AndroidKeyStore/);
  assert.match(androidActivity, /KeyGenParameterSpec/);
  assert.match(android, /HmacSHA256/);
  assert.match(android, /NsdManager/);
  assert.match(android, /MessageDigest\.isEqual/);
  assert.match(android, /MAX_FRAME = 64 \* 1024 \* 1024/);
  assert.match(manifest, /CHANGE_WIFI_MULTICAST_STATE/);
  assert.match(main, /safeStorage\.encryptString\(envelope\)/);
  assert.match(preload, /meshGetConfig/);
  assert.match(transport, /bonjour-service/);
});

test("webview launcher is bounded and works on both macOS and Windows without killing unrelated port owners", async () => {
  const launcher = await readFile("scripts/webview.mjs", "utf8");
  assert.match(launcher, /process\.platform === "darwin"/);
  assert.match(launcher, /process\.platform === "win32"/);
  assert.match(launcher, /taskkill\.exe/);
  assert.match(launcher, /explorer\.exe/);
  assert.match(launcher, /assertPortAvailable/);
  assert.match(launcher, /randomBytes\(24\)/);
  assert.match(launcher, /allowedOrigins\.has\(origin\)/);
  assert.doesNotMatch(launcher, /Access-Control-Allow-Origin", "\*"/);
  assert.doesNotMatch(launcher, /\blsof\b|killPort\(/);
  assert.doesNotMatch(launcher, /\/private\/tmp/);
});
