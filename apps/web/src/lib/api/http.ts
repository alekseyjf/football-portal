/**
 * HTTP-клієнт до API (cookies, JSON).
 *
 * CSRF / SameSite (перед продом):
 * — Див. `apps/api/docs/csrf-samesite-checklist.md`.
 * — Після впровадження CSRF-токена: додати заголовок (або double-submit cookie)
 *   у всіх мутаціях (`apiPost` / `apiPut` / `apiDelete`) і перевірку на Nest.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type NextFetchInit = RequestInit & { next?: { tags?: string[] } };

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const message =
      typeof error === 'object' &&
      error &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : `API error: ${res.status}`;
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** GET (RSC metadata, prefetch queryFn, клієнтські запити). */
export async function apiGet<T>(
  endpoint: string,
  init?: NextFetchInit,
): Promise<T> {
  const { next, ...rest } = init ?? {};
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
    ...rest,
    next,
  });
  return parseResponse<T>(res);
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
    cache: 'no-store',
  });
  return parseResponse<T>(res);
}

export async function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
    cache: 'no-store',
  });
  return parseResponse<T>(res);
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-store',
  });
  return parseResponse<T>(res);
}
