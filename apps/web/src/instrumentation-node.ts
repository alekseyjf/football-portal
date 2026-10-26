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
