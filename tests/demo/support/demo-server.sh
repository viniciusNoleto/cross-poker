#!/usr/bin/env bash
# Sobe o Cross Poker isolado para a gravação do vídeo de demonstração:
#
# - banco `<POSTGRES_DB>_demo`, recriado do zero, no Postgres do container de desenvolvimento
#   (`make up` precisa estar no ar);
# - build de produção em `.next-demo` (não mexe no `.next` do `next dev`), servido na porta DEMO_PORT.
#
# DEMO_SKIP_BUILD=1 reaproveita o último build.
set -euo pipefail

cd "$(dirname "$0")/../../.."

set -a
# shellcheck disable=SC1091
source .env
set +a

PG_CONTAINER="${DEMO_PG_CONTAINER:-cross-poker-postgres}"
DEMO_DB="${POSTGRES_DB}_demo"

docker exec "$PG_CONTAINER" psql -q -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DEMO_DB} WITH (FORCE);"
docker exec "$PG_CONTAINER" psql -q -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${DEMO_DB};"

export POSTGRES_HOST=localhost
export POSTGRES_PORT="${POSTGRES_HOST_PORT:-5433}"
export POSTGRES_DB="$DEMO_DB"
export NEXT_DIST_DIR=.next-demo
export NEXT_TSCONFIG=tsconfig.demo.json
export NEXT_TELEMETRY_DISABLED=1

node db/migrate.mjs

if [ -z "${DEMO_SKIP_BUILD:-}" ]; then
  npx next build
fi

exec npx next start -p "${DEMO_PORT:-3200}"
