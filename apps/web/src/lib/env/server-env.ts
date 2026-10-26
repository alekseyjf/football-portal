import 'server-only';
import { parseServerEnv, type ServerEnv } from './server-env-schema';

let cachedEnv: ServerEnv | undefined;

/**
 * Перевірені серверні змінні web — лише на сервері (`server-only`: імпорт у клієнтському компоненті ламає збірку).
 * Змінні вже перевірено при старті сервера (`instrumentation-node.ts`); тут — розбір з кешем на весь процес.
 */
export function serverEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
