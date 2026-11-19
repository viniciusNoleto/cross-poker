#!/usr/bin/env bash
# Sobe o Cross Poker isolado para os testes E2E (Playwright):
#
# - banco `<POSTGRES_DB>_e2e`, recriado do zero no Postgres do ambiente de desenvolvimento
#   (`make up` precisa estar no ar; TEST_POSTGRES_HOST/TEST_POSTGRES_PORT apontam para outro);
# - build de produção em `.next-e2e` (não mexe no `.next` do `next dev` nem no `.next-demo`),
#   servido na porta E2E_PORT.
#
# E2E_SKIP_BUILD=1 reaproveita o último build.
set -euo pipefail

cd "$(dirname "$0")/../../.."

eval "$(node tests/support/prepare-database.mjs e2e --env)"

export NEXT_DIST_DIR=.next-e2e
export NEXT_TSCONFIG=tsconfig.e2e.json
export NEXT_TELEMETRY_DISABLED=1

if [ -z "${E2E_SKIP_BUILD:-}" ] || [ ! -d .next-e2e ]; then
  npx next build
fi

exec npx next start -p "${E2E_PORT:-3300}"
