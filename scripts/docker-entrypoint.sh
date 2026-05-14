#!/bin/sh
set -eu

STORAGE_DIR="${APP_STORAGE_DIR:-/app/storage}"
CONFIG_DIR="${SETUP_CONFIG_DIR:-/app/storage/config}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/public/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$STORAGE_DIR/backups}"
CONFIG_FILE="$CONFIG_DIR/runtime.env"
TOKEN_FILE="$CONFIG_DIR/setup-token"
STATUS_FILE="$CONFIG_DIR/setup-status.json"
PRISMA_BIN="./node_modules/.bin/prisma"
RUNTIME_USER="nextjs"
RUNTIME_GROUP="nodejs"

prepare_runtime_dirs() {
  mkdir -p "$CONFIG_DIR" "$UPLOAD_DIR" "$BACKUP_DIR"
}

if [ "$(id -u)" = "0" ]; then
  prepare_runtime_dirs
  chown -R "$RUNTIME_USER:$RUNTIME_GROUP" "$STORAGE_DIR" "$UPLOAD_DIR" || {
    echo "[setup] Failed to change ownership for mounted data directories."
    echo "[setup] Ensure APP_PATH points to a writable host directory, for example:"
    echo "[setup]   APP_PATH=/opt/liax-space"
    echo "[setup]   mkdir -p \"\$APP_PATH/data/storage\" \"\$APP_PATH/data/uploads\" \"\$APP_PATH/data/mysql\""
    exit 1
  }
  exec su-exec "$RUNTIME_USER:$RUNTIME_GROUP" "$0" "$@"
fi

if ! prepare_runtime_dirs; then
  echo "[setup] Runtime data directories are not writable by the application user."
  echo "[setup] Check host permissions for \$APP_PATH/data/storage and \$APP_PATH/data/uploads."
  exit 1
fi

if [ -f "$CONFIG_FILE" ]; then
  echo "[setup] Loading runtime config from $CONFIG_FILE"
  set -a
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
  set +a
fi

if [ -z "${SETUP_TOKEN:-}" ]; then
  if [ -f "$TOKEN_FILE" ]; then
    SETUP_TOKEN="$(cat "$TOKEN_FILE")"
  else
    SETUP_TOKEN="$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")"
    printf "%s\n" "$SETUP_TOKEN" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE" 2>/dev/null || true
    echo "[setup] Generated one-time setup token. Read it from $TOKEN_FILE or this log line:"
    echo "[setup] SETUP_TOKEN=$SETUP_TOKEN"
  fi
  export SETUP_TOKEN
fi

write_status() {
  STATUS_STATE="$1" STATUS_ERROR="${2:-}" STATUS_FILE="$STATUS_FILE" node - <<'NODE'
const fs = require("fs");
const path = require("path");
const statusFile = process.env.STATUS_FILE;
const payload = {
  state: process.env.STATUS_STATE,
  updatedAt: new Date().toISOString(),
  error: process.env.STATUS_ERROR || undefined,
  siteUrl: process.env.SITE_URL || undefined,
  databaseHost: process.env.MYSQL_HOST || undefined,
  databaseName: process.env.MYSQL_DATABASE || undefined
};
fs.mkdirSync(path.dirname(statusFile), { recursive: true });
fs.writeFileSync(statusFile, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
NODE
}

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[setup] DATABASE_URL is not configured. Starting setup-safe web server."
  echo "[setup] Open /setup and use SETUP_TOKEN from env, $TOKEN_FILE, or the log above."
  export SETUP_REQUIRED=true
  exec node server.js
fi

echo "[setup] DATABASE_URL detected. Running production migrations."
if "$PRISMA_BIN" migrate deploy; then
  echo "[setup] Prisma migrations applied."
else
  echo "[setup] Prisma migrate deploy failed. Starting setup-safe web server."
  write_status "migration-failed" "Database migration failed. Check database permissions, connection settings, and migration logs."
  export SETUP_REQUIRED=true
  exec node server.js
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[setup] RUN_SEED=true, running Prisma seed."
  if ! "$PRISMA_BIN" db seed; then
    echo "[setup] Prisma seed failed. The app will still start; inspect logs before production use."
  fi
fi

if [ "${RUN_BOOTSTRAP:-true}" != "false" ]; then
  echo "[setup] Running idempotent setup bootstrap."
  if node scripts/setup-bootstrap.mjs; then
    echo "[setup] Bootstrap completed."
  else
    echo "[setup] Bootstrap failed. Starting setup-safe web server."
    write_status "migration-failed" "Database migration succeeded, but OWNER or base settings bootstrap failed. Check OWNER_* configuration."
    export SETUP_REQUIRED=true
    exec node server.js
  fi
fi

exec node server.js
