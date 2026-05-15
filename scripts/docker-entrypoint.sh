#!/bin/sh
set -eu

STORAGE_DIR="${APP_STORAGE_DIR:-/app/storage}"
CONFIG_DIR="${SETUP_CONFIG_DIR:-/app/storage/config}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/public/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$STORAGE_DIR/backups}"
CACHE_DIR="${CACHE_DIR:-$STORAGE_DIR/cache}"
CONFIG_FILE="$CONFIG_DIR/runtime.env"
TOKEN_FILE="$CONFIG_DIR/setup-token"
STATUS_FILE="$CONFIG_DIR/setup-status.json"
PRISMA_BIN="./node_modules/.bin/prisma"
RUNTIME_USER="nextjs"
RUNTIME_GROUP="nodejs"
RUNTIME_UID="1001"
RUNTIME_GID="1001"

prepare_runtime_dirs() {
  mkdir -p "$STORAGE_DIR" "$CONFIG_DIR" "$BACKUP_DIR" "$CACHE_DIR" "$UPLOAD_DIR"
}

if [ "$(id -u)" = "0" ]; then
  prepare_runtime_dirs
  chown -R "$RUNTIME_UID:$RUNTIME_GID" "$STORAGE_DIR" "$UPLOAD_DIR" || {
    echo "[setup] Failed to change ownership for mounted data directories."
    echo "[setup] Ensure APP_PATH points to a writable host directory, for example:"
    echo "[setup]   APP_PATH=/opt/liax-space"
    echo "[setup]   mkdir -p \"\$APP_PATH/data/storage\" \"\$APP_PATH/data/storage/config\" \"\$APP_PATH/data/storage/backups\" \"\$APP_PATH/data/storage/cache\" \"\$APP_PATH/data/uploads\" \"\$APP_PATH/data/mysql\""
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

derive_database_url() {
  if [ -n "${DATABASE_URL:-}" ]; then
    return
  fi

  if [ -z "${MYSQL_HOST:-}" ] || [ -z "${MYSQL_DATABASE:-}" ] || [ -z "${MYSQL_USER:-}" ] || [ -z "${MYSQL_PASSWORD:-}" ]; then
    return
  fi

  DATABASE_URL="$(
    MYSQL_PORT="${MYSQL_PORT:-3306}" node - <<'NODE'
const url = new URL("mysql://localhost");
url.hostname = process.env.MYSQL_HOST;
url.port = process.env.MYSQL_PORT || "3306";
url.username = process.env.MYSQL_USER;
url.password = process.env.MYSQL_PASSWORD;
url.pathname = `/${process.env.MYSQL_DATABASE}`;
process.stdout.write(url.toString());
NODE
  )"
  export DATABASE_URL
  echo "[setup] DATABASE_URL derived from MYSQL_* environment variables."
}

cleanup_sensitive_setup_files() {
  if [ "${CLEAN_SETUP_FILES:-true}" = "false" ]; then
    return
  fi

  if [ -f "$CONFIG_FILE" ] && [ -z "${MYSQL_PASSWORD:-}" ] && [ "${ALLOW_RUNTIME_ENV_CLEANUP_WITHOUT_ENV:-false}" != "true" ]; then
    echo "[setup] Keeping $CONFIG_FILE because MYSQL_PASSWORD is not available from the environment."
    echo "[setup] Set MYSQL_PASSWORD for the app service to allow runtime.env cleanup after setup."
    rm -f "$TOKEN_FILE" "$STATUS_FILE" 2>/dev/null || true
    return
  fi

  rm -f "$CONFIG_FILE" "$TOKEN_FILE" "$STATUS_FILE" 2>/dev/null || true
  echo "[setup] Cleaned sensitive setup files from $CONFIG_DIR."
}

derive_database_url

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

cleanup_sensitive_setup_files

exec node server.js
