import 'server-only';
import { parseServerEnv, type ServerEnv } from './server-env-schema';

let cachedEnv: ServerEnv | undefined;

/**
 * Перевірені серверні змінні web — лише на сервері (`server-only`: імпорт у клієнтському компоненті ламає збірку).
 * Уперше перевіряє `instrumentation.ts` при старті сервера.
 */
export function serverEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
