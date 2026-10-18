import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from './openapi-document';

/**
 * Перший крок `pnpm gen:api-types`: OpenAPI-документ у файл — без сервера, БД і `.env` (D28).
 * `preview: true` — Nest будує граф модулів, але не створює провайдерів: ні з'єднання з БД,
 * ні перевірки env, ні cron. Запуск — лише зі збірки (`nest build`): схеми DTO додає CLI-плагін Swagger.
 * Файл не в git — його генерують `pnpm install` і `pnpm gen:api-types`.
 */
async function writeOpenApiDocument(outputPath: string): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
    abortOnError: false,
  });
  try {
    const json = JSON.stringify(createOpenApiDocument(app), null, 2);
    writeFileSync(outputPath, `${json}\n`);
  } finally {
    await app.close();
  }
}

const [outputArgument] = process.argv.slice(2);
if (!outputArgument) {
  console.error(
    'Usage: node dist/openapi/write-openapi-document.js <output.json>',
  );
  process.exit(1);
}
writeOpenApiDocument(resolve(outputArgument)).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
