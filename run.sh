#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — Start the Inventory System web server.
#   Default port : 8080
#   Fallback     : OS-assigned dynamic port (--web-port 0)
# Usage: bash run.sh [--release]
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_PORT=8080
FLUTTER_FLAGS=("$@")  # forward any extra flags (e.g. --release)

# ── Port availability check ───────────────────────────────────────────────────
port_in_use() {
  # /dev/tcp is a bash built-in; redirect stderr to suppress "connection refused"
  (echo >/dev/tcp/localhost/"$1") 2>/dev/null
}

# ── Pick a port ───────────────────────────────────────────────────────────────
if port_in_use "$DEFAULT_PORT"; then
  echo "⚠  Port $DEFAULT_PORT is already in use — using a dynamic port."
  WEB_PORT=0
else
  WEB_PORT=$DEFAULT_PORT
fi

# ── Launch ────────────────────────────────────────────────────────────────────
if [ "$WEB_PORT" -eq 0 ]; then
  echo "▶  Starting on a dynamic port..."
else
  echo "▶  Starting on http://localhost:$WEB_PORT"
fi

flutter run \
  -d web-server \
  --web-port "$WEB_PORT" \
  --web-hostname localhost \
  "${FLUTTER_FLAGS[@]}"
