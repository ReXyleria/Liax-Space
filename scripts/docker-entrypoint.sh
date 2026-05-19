#!/bin/sh
set -eu

STORAGE_DIR="${APP_STORAGE_DIR:-/app/storage}"
CONFIG_DIR="${SETUP_CONFIG_DIR:-/app/storage/config}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/public/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$STORAGE_DIR/backups}"
CACHE_DIR="${CACHE_DIR:-$STORAGE_DIR/cache}"
TOKEN_FILE="$CONFIG_DIR/setup-token"
STATUS_FILE="$CONFIG_DIR/setup-status.json"
PRISMA_BIN="${PRISMA_BIN:-./node_modules/.bin/prisma}"
RUNTIME_USER="nextjs"
RUNTIME_GROUP="nodejs"
RUNTIME_UID="1001"
RUNTIME_GID="1001"
DATABASE_BOOTSTRAP_ATTEMPTS="${DATABASE_BOOTSTRAP_ATTEMPTS:-45}"
DATABASE_BOOTSTRAP_INTERVAL_SECONDS="${DATABASE_BOOTSTRAP_INTERVAL_SECONDS:-2}"

prepare_runtime_dirs() {
  mkdir -p "$STORAGE_DIR" "$CONFIG_DIR" "$BACKUP_DIR" "$CACHE_DIR" "$UPLOAD_DIR"
}

check_database_connection() {
  node - <<'NODE'
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: [] });

(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors during startup probing.
    }
    process.exit(1);
  }
})();
NODE
}

wait_for_database_connection() {
  attempt=1

  while [ "$attempt" -le "$DATABASE_BOOTSTRAP_ATTEMPTS" ]; do
    if check_database_connection; then
      return 0
    fi

    if [ "$attempt" -lt "$DATABASE_BOOTSTRAP_ATTEMPTS" ]; then
      echo "[setup] Database is not ready yet. Retrying in ${DATABASE_BOOTSTRAP_INTERVAL_SECONDS}s (${attempt}/${DATABASE_BOOTSTRAP_ATTEMPTS})."
      sleep "$DATABASE_BOOTSTRAP_INTERVAL_SECONDS"
    fi

    attempt=$((attempt + 1))
  done

  return 1
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

log_database_url_requirements() {
  missing=""
  [ -z "${MYSQL_HOST:-}" ] && missing="$missing MYSQL_HOST"
  [ -z "${MYSQL_DATABASE:-}" ] && missing="$missing MYSQL_DATABASE"
  [ -z "${MYSQL_USER:-}" ] && missing="$missing MYSQL_USER"
  [ -z "${MYSQL_PASSWORD:-}" ] && missing="$missing MYSQL_PASSWORD"

  echo "[setup] DATABASE_URL is not configured and could not be derived from MYSQL_*."
  if [ -n "$missing" ]; then
    echo "[setup] Missing MYSQL_* variables in the app container:$missing"
    echo "[setup] Compose reminder: variables set on the mysql service are not visible to the app service."
    echo "[setup] Add MYSQL_PASSWORD: \${MYSQL_PASSWORD} to services.app.environment or provide DATABASE_URL."
  else
    echo "[setup] MYSQL_* variables are present, but DATABASE_URL generation did not complete."
  fi
}

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

check_installation_exists() {
  node - <<'NODE'
const { Prisma, PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const databaseName = (() => {
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ""));
  } catch {
    return process.env.MYSQL_DATABASE || "";
  }
})();
const requiredTables = ["SystemInstallation", "User"];
prisma.$queryRaw`
  SELECT TABLE_NAME AS tableName
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = ${databaseName}
    AND TABLE_NAME IN (${Prisma.join(requiredTables)})
`
  .then(rows => {
    const existing = new Set(rows.map(row => row.tableName));
    if (!requiredTables.every(table => existing.has(table))) {
      process.exit(1);
    }
    return prisma.systemInstallation.findUnique({ where: { id: "main" } });
  })
  .then(row => {
    if (row && row.installed) {
      process.exit(0);
    }
    // Fallback: check for Administer user
    return prisma.user.count({ where: { role: "Administer" } });
  })
  .then(count => {
    if (typeof count === "number" && count > 0) {
      process.exit(0);
    }
    process.exit(1);
  })
  .catch(() => process.exit(1));
NODE
}

generate_setup_token() {
  if [ -n "${SETUP_TOKEN:-}" ]; then
    return
  fi

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
}

derive_database_url

if [ -z "${DATABASE_URL:-}" ]; then
  log_database_url_requirements
  write_status "database-url-missing" "DATABASE_URL is not configured and could not be derived from MYSQL_* in the app container."

  if [ -z "${SETUP_TOKEN:-}" ]; then
    generate_setup_token
  fi

  echo "[setup] DATABASE_URL is not configured. Starting setup-safe web server."
  echo "[setup] Open /setup and use SETUP_TOKEN from env, $TOKEN_FILE, or the log above."
  export SETUP_REQUIRED=true
  exec node server.js
fi

# MySQL may still be starting when the app container comes up, so wait briefly
# before treating the database as unavailable and falling back to setup mode.
if ! wait_for_database_connection; then
  echo "[setup] Database did not become ready during startup. Starting setup-safe web server."
  write_status "migration-failed" "Database was not reachable during startup."
  export SETUP_REQUIRED=true
  exec node server.js
fi

echo "[setup] DATABASE_URL detected. Running production migrations."
if "$PRISMA_BIN" migrate deploy; then
  echo "[setup] Prisma migrations applied."
else
  echo "[setup] Prisma migrate deploy failed. Falling back to db push."
  if check_installation_exists; then
    echo "[setup] Existing installation detected. Skipping db push and starting normal web server."
    rm -f "$TOKEN_FILE" "$STATUS_FILE" 2>/dev/null || true
    exec node server.js
  fi
  if "$PRISMA_BIN" db push --accept-data-loss; then
    echo "[setup] Prisma db push completed successfully."
  else
    echo "[setup] Prisma db push also failed. Starting setup-safe web server."
    write_status "migration-failed" "Database migration and schema push both failed. Check database permissions, connection settings, and logs."
    export SETUP_REQUIRED=true
    exec node server.js
  fi
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[setup] RUN_SEED=true, running Prisma seed."
  if ! "$PRISMA_BIN" db seed; then
    echo "[setup] Prisma seed failed. The app will still start; inspect logs before production use."
  fi
fi

if check_installation_exists; then
  echo "[setup] System is already installed (SystemInstallation record or Administer user found)."
  rm -f "$TOKEN_FILE" "$STATUS_FILE" 2>/dev/null || true
  exec node server.js
fi

generate_setup_token
echo "[setup] Database migrated but no installation record found. Starting setup wizard."
echo "[setup] Open /setup and use SETUP_TOKEN from env, $TOKEN_FILE, or the log above."
export SETUP_REQUIRED=true
exec node server.js
