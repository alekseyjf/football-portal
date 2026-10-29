import { isApiError } from './http';

/**
 * Сутність за slug для підпису (чип фільтра, вкладка ліги): 404 — `null`, а не помилка. Так запит «успішний» і
 * сервер передає його клієнту разом з рештою даних, а клієнт не повторює його після гідрації.
 */
export async function nullIfNotFound<T>(
  request: Promise<T>,
): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
