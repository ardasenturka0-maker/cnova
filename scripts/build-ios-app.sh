#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v xcodebuild >/dev/null 2>&1 || { echo "iOS derlemesi için macOS ve Xcode gerekli." >&2; exit 1; }
node "$root/scripts/build-ios-app-assets.mjs"
version="$(node -p "require('$root/package.json').version")"
derived="$root/ios/build"

if [[ -z "${APPLE_DEVELOPMENT_TEAM:-}" ]]; then
  xcodebuild -project "$root/ios/ClinicNova.xcodeproj" -scheme ClinicNova -configuration Release -sdk iphonesimulator -derivedDataPath "$derived" CODE_SIGNING_ALLOWED=NO build
  echo "İmzalanmamış iOS Simulator uygulaması hazır: $derived/Build/Products/Release-iphonesimulator/ClinicNova.app"
  exit 0
fi

archive="$root/releases/ClinicNova-$version-iOS.xcarchive"
xcodebuild -project "$root/ios/ClinicNova.xcodeproj" -scheme ClinicNova -configuration Release -destination 'generic/platform=iOS' -archivePath "$archive" DEVELOPMENT_TEAM="$APPLE_DEVELOPMENT_TEAM" archive
echo "İmzalı iOS arşivi hazır: $archive"
