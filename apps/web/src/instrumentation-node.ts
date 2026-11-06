import { waitForApi } from '@/lib/api/wait-for-api';
import {
  formatServerEnvProblems,
  validateServerEnv,
} from '@/lib/env/server-env-schema';

/*
 * Старт сервера в Node (`instrumentation.ts`): спершу — перевірка серверних змінних. З поганим конфігом процес
 * завершується, як API: інакше Next пише «Ready» і відповідає 500 на кожну сторінку. Збірці (`next build`) змінні не
 * потрібні — вона цього не виконує; `next dev` без `SITE_URL` бере локальну адресу.
 */
const problems = validateServerEnv(process.env);
if (problems.length > 0) {
  console.error(formatServerEnvProblems(problems));
  process.exit(1);
}

// Next не обробляє запити, доки `register()` не завершиться: у `pnpm dev` перша сторінка чекає на API, а не падає (M1.9)
if (process.env.NODE_ENV === 'development') {
  await waitForApi();
}
