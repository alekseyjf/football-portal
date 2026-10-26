/**
 * Старт сервера Next. Next збирає цей файл і для Edge-середовища, тож тут — лише вибір середовища: код для Node
 * (`process.exit`, перевірка змінних) — в `instrumentation-node.ts`, його збирає й виконує лише Node.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
