#!/bin/sh
set -u

CONFIG_DIR="${SETUP_CONFIG_DIR:-/app/storage/config}"
CONFIG_FILE="$CONFIG_DIR/runtime.env"
TOKEN_FILE="$CONFIG_DIR/setup-token"
STATUS_FILE="$CONFIG_DIR/setup-status.json"
PRISMA_BIN="./node_modules/.bin/prisma"
APP_USER="${APP_USER:-nextjs}"
APP_GROUP="${APP_GROUP:-nodejs}"
APP_UID="${APP_UID:-1001}"
APP_GID="${APP_GID:-1001}"
APP_STORAGE_DIR="${APP_STORAGE_DIR:-/app/storage}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/public/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/app/storage/backups}"

run_as_app() {
  if [ "$(id -u)" = "0" ]; then
    su-exec "$APP_USER:$APP_GROUP" "$@"
  else
    "$@"
  fi
}

exec_as_app() {
  if [ "$(id -u)" = "0" ]; then
    exec su-exec "$APP_USER:$APP_GROUP" "$@"
  fi

  exec "$@"
}

print_permission_error() {
  echo "[setup] ERROR: runtime storage is not writable by $APP_USER (UID $APP_UID)." >&2
  echo "[setup] Required writable paths:" >&2
  echo "[setup]   $CONFIG_DIR" >&2
  echo "[setup]   $BACKUP_DIR" >&2
  echo "[setup]   $UPLOAD_DIR" >&2
  echo "[setup] Fix the host bind-mount permissions, then recreate the container:" >&2
  echo "[setup]   mkdir -p ./storage/config ./storage/backups ./public/uploads" >&2
  echo "[setup]   sudo chown -R $APP_UID:$APP_GID ./storage ./public/uploads" >&2
  echo "[setup]   sudo chmod -R u+rwX,g+rwX ./storage ./public/uploads" >&2
  echo "[setup] Do not use chmod 777 or run the application permanently as root." >&2
}

check_writable_dir() {
  DIR_TO_CHECK="$1"
  export DIR_TO_CHECK
  run_as_app sh -c '
    test -d "$DIR_TO_CHECK" &&
    test -w "$DIR_TO_CHECK" &&
    tmp="$DIR_TO_CHECK/.write-test-$$" &&
    : > "$tmp" &&
    rm -f "$tmp"
  '
}

prepare_runtime_dirs() {
  mkdir -p "$CONFIG_DIR" "$UPLOAD_DIR" "$BACKUP_DIR"

  if [ "$(id -u)" = "0" ]; then
    if ! check_writable_dir "$CONFIG_DIR" || ! check_writable_dir "$BACKUP_DIR" || ! check_writable_dir "$UPLOAD_DIR"; then
      chown -R "$APP_USER:$APP_GROUP" "$APP_STORAGE_DIR" "$UPLOAD_DIR" 2>/dev/null || true
      chmod -R ug+rwX "$APP_STORAGE_DIR" "$UPLOAD_DIR" 2>/dev/null || true
    fi
  fi

  if ! check_writable_dir "$CONFIG_DIR" || ! check_writable_dir "$BACKUP_DIR" || ! check_writable_dir "$UPLOAD_DIR"; then
    print_permission_error
    exit 1
  fi
}

exec_server() {
  exec_as_app node server.js
}

prepare_runtime_dirs

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
    SETUP_TOKEN="$(run_as_app node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")"
    export SETUP_TOKEN TOKEN_FILE
    run_as_app sh -c 'printf "%s\n" "$SETUP_TOKEN" > "$TOKEN_FILE" && chmod 600 "$TOKEN_FILE"'
    echo "[setup] Generated one-time setup token. Read it from $TOKEN_FILE or this log line:"
    echo "[setup] SETUP_TOKEN=$SETUP_TOKEN"
  fi
  export SETUP_TOKEN
fi

write_status() {
  STATUS_STATE="$1"
  STATUS_ERROR="${2:-}"
  export STATUS_STATE STATUS_ERROR STATUS_FILE
  run_as_app node - <<'NODE'
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
  exec_server
fi

echo "[setup] DATABASE_URL detected. Running production migrations."
if run_as_app "$PRISMA_BIN" migrate deploy; then
  echo "[setup] Prisma migrations applied."
else
  echo "[setup] Prisma migrate deploy failed. Starting setup-safe web server."
  write_status "migration-failed" "Database migration failed. Check database permissions, connection settings, and migration logs."
  export SETUP_REQUIRED=true
  exec_server
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[setup] RUN_SEED=true, running Prisma seed."
  if ! run_as_app "$PRISMA_BIN" db seed; then
    echo "[setup] Prisma seed failed. The app will still start; inspect logs before production use."
  fi
fi

if [ "${RUN_BOOTSTRAP:-true}" != "false" ]; then
  echo "[setup] Running idempotent setup bootstrap."
  if run_as_app node scripts/setup-bootstrap.mjs; then
    echo "[setup] Bootstrap completed."
  else
    echo "[setup] Bootstrap failed. Starting setup-safe web server."
    write_status "migration-failed" "Database migration succeeded, but OWNER or base settings bootstrap failed. Check OWNER_* configuration."
    export SETUP_REQUIRED=true
    exec_server
  fi
fi

exec_server
