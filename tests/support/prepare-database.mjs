// CLI: recria o banco descartável `<POSTGRES_DB>_<sufixo>` (ver database.mjs).
//
//   node tests/support/prepare-database.mjs e2e               recria e avisa
//   eval "$(node tests/support/prepare-database.mjs e2e --env)"   recria e exporta POSTGRES_* no shell
import { recreateDatabase } from './database.mjs';

const suffix = process.argv[2] ?? 'test';
const env = await recreateDatabase(suffix);

if (process.argv.includes('--env')) {
  for (const [key, value] of Object.entries(env)) console.log(`export ${key}=${JSON.stringify(value)}`);
} else {
  console.log(`Banco ${env.POSTGRES_DB} recriado e migrado.`);
}
