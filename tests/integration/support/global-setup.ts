import { recreateDatabase } from '../../support/database.mjs';

// Uma vez por execução: recria `<POSTGRES_DB>_test` do zero e aplica as migrações.
export default async function setup() {
  await recreateDatabase('test');
}
