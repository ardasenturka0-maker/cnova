#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
BUILD_DIR="$MOBILE_DIR/build"
CACHE_DIR="$MOBILE_DIR/.cache"
RELEASE_DIR="$ROOT_DIR/releases"
SIGNING_DIR="$ROOT_DIR/.android-signing"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/usr/lib/android-sdk}}"
ANDROID_API="${ANDROID_API:-36}"
ANDROID_JAR="${ANDROID_JAR:-$ANDROID_SDK_ROOT/platforms/android-$ANDROID_API/android.jar}"
R8_VERSION="9.1.31"
R8_JAR="$CACHE_DIR/r8-$R8_VERSION.jar"
R8_URL="https://dl.google.com/dl/android/maven2/com/android/tools/r8/$R8_VERSION/r8-$R8_VERSION.jar"
VERSION_NAME="$(node -p "require('$ROOT_DIR/package.json').version")"
VERSION_CORE="${VERSION_NAME%%-*}"
IFS=. read -r VERSION_MAJOR VERSION_MINOR VERSION_PATCH <<< "$VERSION_CORE"
VERSION_CODE=$((10#$VERSION_MAJOR * 10000 + 10#$VERSION_MINOR * 100 + 10#$VERSION_PATCH))
OUTPUT_APK="$RELEASE_DIR/ClinicNova-$VERSION_NAME.apk"
MOBILE_MODE="${MOBILE_MODE:-production}"
MOBILE_SERVER_URL="${MOBILE_SERVER_URL:-}"
PACKAGE_ASSETS="$BUILD_DIR/assets"

for command in node aapt2 javac jar java zip zipalign apksigner keytool curl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Eksik Android derleme aracı: $command" >&2
    exit 1
  fi
done

if [[ ! -f "$ANDROID_JAR" ]]; then
  echo "Android API $ANDROID_API platformu bulunamadı: $ANDROID_JAR" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$CACHE_DIR" "$RELEASE_DIR" "$SIGNING_DIR"
find "$BUILD_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
mkdir -p "$BUILD_DIR/compiled" "$BUILD_DIR/generated" "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$PACKAGE_ASSETS"
cp -R "$MOBILE_DIR/assets/." "$PACKAGE_ASSETS/"
node "$ROOT_DIR/scripts/write-mobile-runtime-config.mjs" "$PACKAGE_ASSETS/runtime-config.js" "$MOBILE_MODE" "$MOBILE_SERVER_URL" "$VERSION_NAME"

if [[ ! -f "$R8_JAR" ]]; then
  echo "R8/D8 $R8_VERSION indiriliyor..."
  curl --fail --location --retry 3 --output "$R8_JAR.tmp" "$R8_URL"
  mv "$R8_JAR.tmp" "$R8_JAR"
fi

echo "Android kaynakları derleniyor..."
aapt2 compile --dir "$MOBILE_DIR/res" -o "$BUILD_DIR/compiled/resources.zip"
aapt2 link \
  -o "$BUILD_DIR/resources.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$MOBILE_DIR/AndroidManifest.xml" \
  --java "$BUILD_DIR/generated" \
  --min-sdk-version 26 \
  --target-sdk-version 36 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  -A "$PACKAGE_ASSETS" \
  "$BUILD_DIR/compiled/resources.zip"

echo "Java ve DEX çıktıları oluşturuluyor..."
find "$MOBILE_DIR/src" "$BUILD_DIR/generated" -type f -name '*.java' -print | sort > "$BUILD_DIR/java-sources.txt"
javac --release 8 -classpath "$ANDROID_JAR" -d "$BUILD_DIR/classes" @"$BUILD_DIR/java-sources.txt"
jar --create --file "$BUILD_DIR/classes.jar" -C "$BUILD_DIR/classes" .
java -cp "$R8_JAR" com.android.tools.r8.D8 \
  --release \
  --min-api 26 \
  --lib "$ANDROID_JAR" \
  --output "$BUILD_DIR/dex" \
  "$BUILD_DIR/classes.jar"

cp "$BUILD_DIR/resources.apk" "$BUILD_DIR/unsigned.apk"
(
  cd "$BUILD_DIR/dex"
  zip -q -j "$BUILD_DIR/unsigned.apk" classes.dex
)
zipalign -f -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"

PROPERTIES_FILE="$SIGNING_DIR/keystore.properties"
if [[ -f "$PROPERTIES_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$PROPERTIES_FILE"
fi
: "${STORE_PASSWORD:?STORE_PASSWORD ortam değişkeni veya $PROPERTIES_FILE içinde ayarlanmalı}"
: "${KEY_ALIAS:=clinicnova}"
KEYSTORE_FILE="${ANDROID_KEYSTORE_FILE:-$SIGNING_DIR/clinicnova-release.jks}"

if [[ ! -f "$KEYSTORE_FILE" ]]; then
  echo "ClinicNova imzalama anahtarı oluşturuluyor..."
  keytool -genkeypair -noprompt \
    -keystore "$KEYSTORE_FILE" \
    -storepass "$STORE_PASSWORD" \
    -keypass "$STORE_PASSWORD" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 4096 \
    -validity 10000 \
    -dname "CN=ClinicNova, OU=Mobile, O=ClinicNova, L=Istanbul, C=TR"
  chmod 600 "$KEYSTORE_FILE"
fi

echo "APK hizalanıyor ve imzalanıyor..."
apksigner sign \
  --ks "$KEYSTORE_FILE" \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$STORE_PASSWORD" \
  --key-pass "pass:$STORE_PASSWORD" \
  --out "$OUTPUT_APK" \
  "$BUILD_DIR/aligned.apk"

zipalign -c -p 4 "$OUTPUT_APK"
apksigner verify --verbose --print-certs "$OUTPUT_APK"
sha256sum "$OUTPUT_APK"
echo "APK hazır: $OUTPUT_APK"
