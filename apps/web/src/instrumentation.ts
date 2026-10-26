/**
 * Старт сервера Next: спершу — перевірка серверних змінних (`lib/env/server-env-schema.ts`). З поганим конфігом процес
 * завершується, як API: інакше Next пише «Ready» і відповідає 500 на кожну сторінку. Збірці (`next build`) змінні не
 * потрібні — вона цього не викликає.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { serverEnv } = await import('@/lib/env/server-env');
  try {
    serverEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
