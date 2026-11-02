import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiGet, apiPost } from './http';

const PUBLIC_POST = {
  cache: 'public',
  tags: ['post:42'],
  revalidate: 3600,
} as const;

describe('Кеш даних Next для запитів до API (M1.8.3)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function lastFetchInit(): RequestInit & { next?: unknown } {
    return fetchMock.mock.calls.at(-1)?.[1] as RequestInit & { next?: unknown };
  }

  beforeEach(() => {
    fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('публічний на сервері — у кеш з тегами й TTL, без `no-store`', async () => {
    await apiGet('/posts/42?lang=en', PUBLIC_POST);
    const init = lastFetchInit();
    expect(init.next).toEqual({ tags: ['post:42'], revalidate: 3600 });
    expect(init.cache).toBeUndefined();
  });

  it('за замовчуванням і мутації — `no-store`, без тегів', async () => {
    await apiGet('/auth/me');
    expect(lastFetchInit()).toMatchObject({ cache: 'no-store' });
    expect(lastFetchInit().next).toBeUndefined();

    await apiPost('/likes', { targetType: 'post' });
    expect(lastFetchInit()).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
    expect(lastFetchInit().next).toBeUndefined();
  });

  it.each(['Cookie', 'authorization'])(
    'публічний з заголовком %s — помилка до запиту: персональна відповідь у спільний кеш не потрапить',
    (header) => {
      expect(() =>
        apiFetch(
          '/posts/42?lang=en',
          { method: 'GET', headers: { [header]: 'access_token=secret' } },
          PUBLIC_POST,
        ),
      ).toThrow(/must not send/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('у браузері кешу даних Next немає — і публічний `no-store`', async () => {
    vi.stubGlobal('window', {});
    await apiGet('/posts/42?lang=en', PUBLIC_POST);
    expect(lastFetchInit()).toMatchObject({ cache: 'no-store' });
    expect(lastFetchInit().next).toBeUndefined();
  });
});
