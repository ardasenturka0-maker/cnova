#!/bin/zsh
set -e

SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
  SCRIPT_DIR="$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"
  SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
  case "$SCRIPT_PATH" in
    /*) ;;
    *) SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_PATH" ;;
  esac
done

cd "$(cd -P "$(dirname "$SCRIPT_PATH")" && pwd)"

NODE_VERSION="v20.20.2"
ARCH="$(uname -m)"

if [ "$ARCH" = "arm64" ]; then
  NODE_DIST="node-${NODE_VERSION}-darwin-arm64"
else
  NODE_DIST="node-${NODE_VERSION}-darwin-x64"
fi

NODE_HOME="/private/tmp/clinicnova-node/${NODE_DIST}"

if [ ! -x "${NODE_HOME}/bin/node" ]; then
  mkdir -p /private/tmp/clinicnova-node
  echo "ClinicNova icin lokal Node indiriliyor..."
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIST}.tar.gz" -o /private/tmp/clinicnova-node/node.tar.gz
  tar -xzf /private/tmp/clinicnova-node/node.tar.gz -C /private/tmp/clinicnova-node
fi

export PATH="${NODE_HOME}/bin:${PATH}"

if [ ! -d node_modules ]; then
  npm install
fi

npm run webview
