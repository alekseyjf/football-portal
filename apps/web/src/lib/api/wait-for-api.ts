import { apiGet, isApiError } from '@/lib/api/http';

const API_WAIT_TIMEOUT_MS = 60_000;
const API_RETRY_INTERVAL_MS = 500;

/**
 * Чекає першої відповіді API — лише для `next dev` (`instrumentation-node.ts`, M1.9): у `pnpm dev` сайт готовий за пів
 * секунди, а API — за кілька (`prisma generate`, компіляція Nest), і вкладку, яку Next перезавантажує після рестарту,
 * сервер віддав би раніше за API — головна впала б з `HOME_API_UNAVAILABLE`. Не дочекались — сторінки покажуть помилку.
 */
export async function waitForApi(): Promise<void> {
  const deadline = Date.now() + API_WAIT_TIMEOUT_MS;
  let isWaiting = false;
  while (Date.now() < deadline) {
    if (await isApiResponding()) {
      if (isWaiting) console.info('API is up — serving pages');
      return;
    }
    if (!isWaiting) console.info('Waiting for the API before serving pages…');
    isWaiting = true;
    await new Promise((resolve) => setTimeout(resolve, API_RETRY_INTERVAL_MS));
  }
  console.warn(
    `API did not respond in ${API_WAIT_TIMEOUT_MS / 1000} s — pages that need it will show an error`,
  );
}

async function isApiResponding(): Promise<boolean> {
  try {
    await apiGet('/health');
    return true;
  } catch (error) {
    // Відповідь з помилкою (503 — API живе, БД ні) — теж відповідь: гонки старту вже немає. Мережева — ще чекаємо
    return isApiError(error);
  }
}
