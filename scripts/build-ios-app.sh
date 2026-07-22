#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v xcodebuild >/dev/null 2>&1 || { echo "iOS derlemesi için macOS ve Xcode gerekli." >&2; exit 1; }
node "$root/scripts/build-ios-app-assets.mjs"
version="$(node -p "require('$root/package.json').version")"
marketing_version="${version%%-*}"
IFS=. read -r version_major version_minor version_patch <<< "$marketing_version"
build_number=$((10#$version_major * 10000 + 10#$version_minor * 100 + 10#$version_patch))
derived="$root/ios/build"

if [[ -z "${APPLE_DEVELOPMENT_TEAM:-}" ]]; then
  xcodebuild -project "$root/ios/ClinicNova.xcodeproj" -scheme ClinicNova -configuration Release -sdk iphonesimulator -derivedDataPath "$derived" CODE_SIGNING_ALLOWED=NO MARKETING_VERSION="$marketing_version" CURRENT_PROJECT_VERSION="$build_number" build
  echo "İmzalanmamış iOS Simulator uygulaması hazır: $derived/Build/Products/Release-iphonesimulator/ClinicNova.app"
  exit 0
fi

archive="$root/releases/ClinicNova-$version-iOS.xcarchive"
xcodebuild -project "$root/ios/ClinicNova.xcodeproj" -scheme ClinicNova -configuration Release -destination 'generic/platform=iOS' -archivePath "$archive" DEVELOPMENT_TEAM="$APPLE_DEVELOPMENT_TEAM" MARKETING_VERSION="$marketing_version" CURRENT_PROJECT_VERSION="$build_number" archive
echo "İmzalı iOS arşivi hazır: $archive"
