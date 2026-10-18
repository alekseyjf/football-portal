import {
  E2E_SCHEMA,
  rebuildE2eSchema,
  resolveE2eDatabaseUrl,
} from './e2e-database';

/** Раз на прогін (jest `globalSetup`): схема `e2e` — з нуля за поточними міграціями. */
export default async function globalSetup(): Promise<void> {
  const { url, source } = resolveE2eDatabaseUrl();
  const startedAt = Date.now();
  const migrationCount = await rebuildE2eSchema(url);
  console.log(
    `\ne2e: schema "${E2E_SCHEMA}" rebuilt from ${migrationCount} migrations in ${Date.now() - startedAt} ms (connection: ${source})`,
  );
}
