#!/usr/bin/env bash
# Keeps Next.js + WhatsApp webhook route warm so Meta deliveries aren't "asleep".
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL_FILE="$ROOT/.whatsapp-tunnel-url"
INTERVAL="${KEEPALIVE_INTERVAL_SEC:-20}"

echo "[keepalive] starting (every ${INTERVAL}s)"
while true; do
  # Warm local app + webhook handler
  curl -s -m 5 "http://localhost:3000/api/health" >/dev/null || echo "[keepalive] local health miss"
  curl -s -m 5 \
    "http://localhost:3000/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=aidhd_verify&hub.challenge=ping" \
    >/dev/null || echo "[keepalive] local webhook miss"

  if [[ -f "$URL_FILE" ]]; then
    TUN="$(tr -d '[:space:]' < "$URL_FILE")"
    if [[ -n "$TUN" ]]; then
      curl -s -m 10 \
        "$TUN/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=aidhd_verify&hub.challenge=ping" \
        >/dev/null 2>&1 || true
    fi
  fi

  # Ensure cloudflared still running; if not, tip only (don't auto-spawn forever loops here)
  if ! pgrep -f "cloudflared tunnel --url" >/dev/null 2>&1; then
    echo "[keepalive] WARNING: cloudflared tunnel not running — Meta won't reach webhook"
  fi

  sleep "$INTERVAL"
done
