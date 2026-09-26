/**
 * HTTP-клієнт до API (cookies, JSON). Логіка refresh — та сама, що в `apps/web/src/lib/api/http.ts`:
 * змінюєш одну — зміни й іншу.
 *
 * Сесія: access-cookie живе 15 хв. На 401 клієнт один раз викликає `POST /auth/refresh`
 * і повторює запит (лише в браузері). Паралельні запити чекають один спільний refresh.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Помилка відповіді API. `code` (він же `message`) — `message` з тіла Nest: наш код
 * (`ACCOUNT_LOCKED`, `EMAIL_BLOCKED`, `TOO_MANY_REQUESTS` …) або текст помилки.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** З `Retry-After-*` (429): через скільки секунд можна повторити. */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, retryAfterSeconds: number | null) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Throttler API ставить `Retry-After-<ліміт>` (`ip`, `account`), секунди. */
const RETRY_AFTER_HEADERS = ['Retry-After-ip', 'Retry-After-account', 'Retry-After'];

function readRetryAfterSeconds(response: Response): number | null {
  const waitSeconds = RETRY_AFTER_HEADERS.map((headerName) =>
    Number(response.headers.get(headerName)),
  ).filter((seconds) => Number.isFinite(seconds) && seconds > 0);
  return waitSeconds.length > 0 ? Math.max(...waitSeconds) : null;
}

async function toApiError(response: Response): Promise<ApiError> {
  const errorBody: unknown = await response.json().catch(() => null);
  const bodyMessage =
    typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
      ? (errorBody as { message: unknown }).message
      : undefined;
  // ValidationPipe віддає масив повідомлень
  const code =
    typeof bodyMessage === 'string'
      ? bodyMessage
      : Array.isArray(bodyMessage)
        ? bodyMessage.join('; ')
        : `API error: ${response.status}`;
  return new ApiError(response.status, code, readRetryAfterSeconds(response));
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Refresh-сесії ───

/** Власні помилки цих роутів — відповідь для форми, а не прострочений access. */
const ENDPOINTS_WITHOUT_REFRESH = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);
/** Успішна відповідь ставить cookies нової сесії. */
const SESSION_START_ENDPOINTS = new Set(['/auth/login']);

type RefreshOutcome =
  | { kind: 'refreshed' }
  /** 401 / 403 від refresh: сесії більше немає (API вже прибрав cookies). */
  | { kind: 'expired'; error: ApiError }
  /** 429, мережа, 5xx: сесія, можливо, жива — не розлогінюємо. */
  | { kind: 'unavailable'; error: unknown };

type SessionExpiredListener = (error: ApiError) => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();
let refreshInFlight: Promise<RefreshOutcome> | null = null;
/**
 * Росте з кожним успішним refresh і логіном: 401 на запит, відправлений до них, —
 * про стару сесію, тож не привід ні для ще одного refresh, ні для виходу.
 */
let sessionGeneration = 0;
/** Після 429 не стукаємо в refresh до `Retry-After`. */
let refreshThrottledUntil = 0;
let refreshThrottleError: ApiError | null = null;

/** Refresh остаточно відхилено (401 / 403) — сесію завершено. Повертає відписку. */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function endpointPath(endpoint: string): string {
  return endpoint.split('?')[0];
}

function canRefreshSessionFor(endpoint: string): boolean {
  if (typeof window === 'undefined') return false;
  return !ENDPOINTS_WITHOUT_REFRESH.has(endpointPath(endpoint));
}

function refreshSession(): Promise<RefreshOutcome> {
  if (refreshThrottleError && Date.now() < refreshThrottledUntil) {
    return Promise.resolve({ kind: 'unavailable', error: refreshThrottleError });
  }
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

const DEFAULT_REFRESH_RETRY_AFTER_SECONDS = 60;

async function performRefresh(): Promise<RefreshOutcome> {
  const generationAtStart = sessionGeneration;
  let response: Response;
  try {
    response = await sendRequest('/auth/refresh', { method: 'POST' });
  } catch (networkError) {
    return { kind: 'unavailable', error: networkError };
  }

  // 409 REFRESH_SUPERSEDED: цей токен щойно ротувала інша вкладка, нові cookies
  // вже в браузері — просто повторюємо запит (P2-5)
  if (response.ok || response.status === 409) {
    sessionGeneration += 1;
    return { kind: 'refreshed' };
  }

  const error = await toApiError(response);
  if (response.status === 401 || response.status === 403) {
    // Поки refresh був у дорозі, користувач залогінився: відмова стосується старої сесії
    if (generationAtStart !== sessionGeneration) return { kind: 'refreshed' };
    sessionExpiredListeners.forEach((listener) => listener(error));
    return { kind: 'expired', error };
  }
  if (response.status === 429) {
    const waitSeconds =
      error.retryAfterSeconds ?? DEFAULT_REFRESH_RETRY_AFTER_SECONDS;
    refreshThrottledUntil = Date.now() + waitSeconds * 1000;
    refreshThrottleError = error;
  }
  return { kind: 'unavailable', error };
}

function sendRequest(endpoint: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${endpoint}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
}

async function request<T>(endpoint: string, init: RequestInit): Promise<T> {
  const generationAtSend = sessionGeneration;
  const response = await sendRequest(endpoint, init);
  if (response.ok && SESSION_START_ENDPOINTS.has(endpointPath(endpoint))) {
    sessionGeneration += 1;
  }
  if (response.status !== 401 || !canRefreshSessionFor(endpoint)) {
    return parseResponse<T>(response);
  }

  const outcome =
    generationAtSend === sessionGeneration
      ? await refreshSession()
      : ({ kind: 'refreshed' } as const);

  if (outcome.kind === 'refreshed') {
    // Лише один повтор: повторний 401 іде викликачу як є
    return parseResponse<T>(await sendRequest(endpoint, init));
  }
  if (outcome.kind === 'expired') {
    // 403 від refresh несе причину (`ACCOUNT_LOCKED`), 401 — нічого нового
    throw outcome.error.status === 403 ? outcome.error : await toApiError(response);
  }
  throw outcome.error;
}

// ─── Публічні методи ───

export async function apiGet<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPut<T>(endpoint: string, body: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** `body` — для підтвердження паролем (`DELETE /users/me`). */
export async function apiDelete<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'DELETE',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
}
