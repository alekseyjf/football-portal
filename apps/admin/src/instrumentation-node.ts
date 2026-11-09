import {
  formatServerEnvProblems,
  validateServerEnv,
} from '@/lib/env/server-env-schema';

/*
 * Старт сервера в Node (`instrumentation.ts`): перевірка серверних змінних (D59). З поганим конфігом процес завершується,
 * як API і web: інакше тест-сервер стартував би без пароля чи без секрету для API. Збірці (`next build`) змінні не
 * потрібні — вона цього не виконує.
 */
const problems = validateServerEnv(process.env);
if (problems.length > 0) {
  console.error(formatServerEnvProblems(problems));
  process.exit(1);
}
