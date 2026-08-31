#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/com.tjacquin.pr-guide.plist"
# launchd ne charge pas le PATH du shell de connexion : le démon a besoin de
# `gh` (Homebrew) et `claude` (nvm) pour analyser une PR, donc on propage le
# PATH courant du script dans le plist.
DAEMON_PATH="$PATH"

pnpm -C "$ROOT" -F @pr-guide/daemon build

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.tjacquin.pr-guide</string>
  <key>ProgramArguments</key><array>
    <string>${NODE}</string>
    <string>${ROOT}/packages/daemon/dist/index.cjs</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>${DAEMON_PATH}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/pr-guide.log</string>
  <key>StandardErrorPath</key><string>/tmp/pr-guide.err</string>
</dict></plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "pr-guide : démon installé (logs : /tmp/pr-guide.log)"
