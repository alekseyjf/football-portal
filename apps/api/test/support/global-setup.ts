import { describeSchemaTarget } from '../../prisma/schema-target';
import { startContractJournal } from './contract-coverage';
import {
  assertE2eSchemaTarget,
  createE2ePrismaClient,
  E2E_SCHEMA,
  rebuildE2eSchema,
  resolveE2eDatabaseUrl,
} from './e2e-database';

/**
 * Раз на прогін (jest `globalSetup`): схема `e2e` — з нуля за поточними міграціями (сама перебудова перевіряє
 * `current_schema()` у своїй транзакції); потім — що клієнт Prisma тестів теж потрапляє в `e2e`: пулер, який
 * відкидає `search_path`, зупиняє прогін тут, а не в кожному файлі. Порожній журнал покриття контракту (його
 * перевіряє `global-teardown.ts`).
 */
export default async function globalSetup(): Promise<void> {
  const { url, source } = resolveE2eDatabaseUrl();
  const startedAt = Date.now();
  const migrationCount = await rebuildE2eSchema(url);
  const prisma = createE2ePrismaClient(url);
  try {
    const target = await assertE2eSchemaTarget(prisma);
    console.log(
      `\ne2e: schema "${E2E_SCHEMA}" rebuilt from ${migrationCount} migrations in ${Date.now() - startedAt} ms (connection: ${source}; target: ${describeSchemaTarget(target)})`,
    );
  } finally {
    await prisma.$disconnect();
  }
  startContractJournal();
}
