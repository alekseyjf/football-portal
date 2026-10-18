import { Logger } from '@nestjs/common';
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { FOOTBALL_API_REQUEST_INTERVAL_MS } from '../../football.constants';
import {
  FootballDataClient,
  type FootballDataEnv,
} from './football-data.client';

const FOOTBALL_ENV: FootballDataEnv = {
  FOOTBALL_API_KEY: 'test-token',
  FOOTBALL_API_URL: 'https://api.football-data.org/v4',
  FOOTBALL_HTTP_LOG: false,
};

function httpError(
  status: number,
  headers: Record<string, string> = {},
): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
  const response: AxiosResponse = {
    status,
    statusText: String(status),
    headers,
    config,
    data: {},
  };
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    {},
    response,
  );
}

describe('FootballDataClient — черга запитів (F9, P5-1)', () => {
  let getMock: jest.Mock;
  /** Мс від початку тесту, коли стартував кожен HTTP-запит */
  let requestStartOffsets: number[];
  /** Відповіді-помилки для наступних запитів по черзі; далі — успіх */
  let plannedFailures: AxiosError[];

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.parse('2026-09-26T18:00:00Z') });
    const testStartedAt = Date.now();
    requestStartOffsets = [];
    plannedFailures = [];
    getMock = jest.fn((requestPath: string) => {
      requestStartOffsets.push(Date.now() - testStartedAt);
      const plannedFailure = plannedFailures.shift();
      return plannedFailure
        ? Promise.reject(plannedFailure)
        : Promise.resolve({ data: { requestPath } });
    });
    jest
      .spyOn(axios, 'create')
      .mockReturnValue({ get: getMock } as unknown as AxiosInstance);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('паралельні запити стартують не частіше за інтервал', async () => {
    const client = new FootballDataClient(FOOTBALL_ENV);
    const requests = [
      client.getJson('/a'),
      client.getJson('/b'),
      client.getJson('/c'),
    ];
    await jest.advanceTimersByTimeAsync(3 * FOOTBALL_API_REQUEST_INTERVAL_MS);
    await Promise.all(requests);
    expect(requestStartOffsets).toEqual([
      0,
      FOOTBALL_API_REQUEST_INTERVAL_MS,
      2 * FOOTBALL_API_REQUEST_INTERVAL_MS,
    ]);
  });

  it('429 відсуває і запит, що вже чекає свого слоту в черзі', async () => {
    plannedFailures.push(httpError(429, { 'x-requestcounter-reset': '30' }));
    const client = new FootballDataClient(FOOTBALL_ENV);
    const firstRequest = client.getJson('/first');
    const queuedRequest = client.getJson('/queued');
    await jest.advanceTimersByTimeAsync(60_000);

    await expect(firstRequest).resolves.toEqual({ requestPath: '/first' });
    await expect(queuedRequest).resolves.toEqual({ requestPath: '/queued' });
    // Лічильник провайдера скидається через 30 с (+1 с запасу): запит, що вже чекав у
    // черзі, не стартує раніше — інакше отримав би 429 знову; повтор першого — за ним
    expect(requestStartOffsets).toEqual([
      0,
      31_000,
      31_000 + FOOTBALL_API_REQUEST_INTERVAL_MS,
    ]);
  });

  it('404 — без повтору: FootballProviderError NOT_FOUND', async () => {
    plannedFailures.push(httpError(404));
    const client = new FootballDataClient(FOOTBALL_ENV);
    const assertion = expect(
      client.getJson('/competitions/EC/standings'),
    ).rejects.toMatchObject({
      name: 'FootballProviderError',
      kind: 'NOT_FOUND',
    });
    await jest.advanceTimersByTimeAsync(0);
    await assertion;
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('повторний 429 — рівно дві спроби, далі RATE_LIMITED', async () => {
    plannedFailures.push(
      httpError(429, { 'x-requestcounter-reset': '5' }),
      httpError(429, { 'x-requestcounter-reset': '5' }),
    );
    const client = new FootballDataClient(FOOTBALL_ENV);
    const assertion = expect(
      client.getJson('/competitions/PL/matches'),
    ).rejects.toMatchObject({ kind: 'RATE_LIMITED' });
    await jest.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it('без ключа — AUTH і жодного HTTP-запиту', async () => {
    const client = new FootballDataClient({
      ...FOOTBALL_ENV,
      FOOTBALL_API_KEY: undefined,
    });
    expect(client.hasApiKey()).toBe(false);
    const assertion = expect(
      client.getJson('/competitions/PL'),
    ).rejects.toMatchObject({ kind: 'AUTH' });
    await jest.advanceTimersByTimeAsync(0);
    await assertion;
    expect(getMock).not.toHaveBeenCalled();
  });
});
