import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { envConfig } from '../../../config/env.config';
import type { AppEnv } from '../../../config/env.schema';
import {
  FOOTBALL_API_MAX_RETRY_WAIT_MS,
  FOOTBALL_API_REQUEST_INTERVAL_MS,
  pauseMilliseconds,
} from '../../football.constants';
import { FootballProviderError } from '../football-provider.port';

const REQUEST_TIMEOUT_MS = 45_000;
/** Друга спроба — лише для 429, 5xx і мережевих збоїв */
const MAX_REQUEST_ATTEMPTS = 2;

/** Змінні середовища, які читає клієнт (схема — `config/env.schema.ts`). */
export type FootballDataEnv = Pick<
  AppEnv,
  'FOOTBALL_API_KEY' | 'FOOTBALL_API_URL' | 'FOOTBALL_HTTP_LOG'
>;

/**
 * HTTP до football-data.org (axios). Усі запити процесу йдуть **однією чергою** з інтервалом
 * між стартами (F9): повний синк, LIVE і `live-touch` разом не перевищують 10 запитів / хв.
 * Кілька інстансів API ділять квоту ключа — тоді інтервал треба збільшити.
 */
@Injectable()
export class FootballDataClient {
  private readonly log = new Logger(FootballDataClient.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly logRequests: boolean;
  private axiosInstance: AxiosInstance | null = null;
  /** Хвіст черги: кожен запит чекає свого слоту після попереднього */
  private requestQueueTail: Promise<void> = Promise.resolve();
  private nextRequestNotBefore = 0;

  constructor(@Inject(envConfig.KEY) env: FootballDataEnv) {
    this.apiKey = env.FOOTBALL_API_KEY;
    this.baseUrl = env.FOOTBALL_API_URL;
    this.logRequests = env.FOOTBALL_HTTP_LOG;
  }

  hasApiKey(): boolean {
    return this.apiKey !== undefined;
  }

  async getJson<ResponseBody>(
    requestPath: string,
    query?: Record<string, string>,
  ): Promise<ResponseBody> {
    for (let attempt = 1; ; attempt += 1) {
      await this.waitForRequestSlot();
      try {
        const { data } = await this.getAxios().get<ResponseBody>(requestPath, {
          params: query,
        });
        return data;
      } catch (error: unknown) {
        const retryAfterMs =
          attempt < MAX_REQUEST_ATTEMPTS ? retryDelayFor(error) : null;
        if (retryAfterMs === null) {
          throw toProviderError(error, requestPath);
        }
        this.log.warn(
          `football-data GET ${requestPath} → ${describeFailure(error)}; повтор через ${Math.round(retryAfterMs / 1000)} с`,
        );
        this.postponeNextRequest(retryAfterMs);
      }
    }
  }

  private waitForRequestSlot(): Promise<void> {
    const requestSlot = this.requestQueueTail.then(async () => {
      // Поки слот чекав, 429 попереднього запиту міг відсунути старт — перевіряти після паузи
      for (
        let waitMs = this.nextRequestNotBefore - Date.now();
        waitMs > 0;
        waitMs = this.nextRequestNotBefore - Date.now()
      ) {
        await pauseMilliseconds(waitMs);
      }
      this.nextRequestNotBefore = Date.now() + FOOTBALL_API_REQUEST_INTERVAL_MS;
    });
    this.requestQueueTail = requestSlot;
    return requestSlot;
  }

  private postponeNextRequest(delayMs: number): void {
    this.nextRequestNotBefore = Math.max(
      this.nextRequestNotBefore,
      Date.now() + delayMs,
    );
  }

  private getAxios(): AxiosInstance {
    if (!this.apiKey) {
      throw new FootballProviderError('AUTH', 'FOOTBALL_API_KEY is not set');
    }
    if (!this.axiosInstance) {
      if (/^\d{1,6}$/.test(this.apiKey)) {
        this.log.warn(
          'FOOTBALL_API_KEY схожий на id змагання. Потрібен токен з кабінету football-data.org.',
        );
      }
      this.axiosInstance = axios.create({
        baseURL: this.baseUrl,
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'X-Auth-Token': this.apiKey },
      });
      this.attachRequestLogging(this.axiosInstance);
    }
    return this.axiosInstance;
  }

  private attachRequestLogging(client: AxiosInstance): void {
    if (!this.logRequests) return;

    client.interceptors.request.use((config) => {
      this.log.log(`[football-data] → GET ${client.getUri(config)}`);
      return config;
    });
    client.interceptors.response.use(
      (response) => {
        const requestsLeft = response.headers['x-requests-available-minute'] as
          | string
          | undefined;
        this.log.log(
          `[football-data] ← ${response.status} ${client.getUri(response.config)}` +
            (requestsLeft === undefined
              ? ''
              : ` (лишилось ${requestsLeft} / хв)`),
        );
        return response;
      },
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.config) {
          this.log.warn(
            `[football-data] ← ${error.response?.status ?? 'ERR'} ${client.getUri(error.config)}`,
          );
        }
        throw error;
      },
    );
  }
}

/** Скільки чекати перед повтором; `null` — повтор не має сенсу. */
function retryDelayFor(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  const status = error.response?.status;
  if (status === 429) {
    const resetSeconds = Number(
      error.response?.headers['x-requestcounter-reset'],
    );
    const waitMs =
      Number.isFinite(resetSeconds) && resetSeconds > 0
        ? resetSeconds * 1000 + 1000
        : FOOTBALL_API_MAX_RETRY_WAIT_MS;
    return Math.min(waitMs, FOOTBALL_API_MAX_RETRY_WAIT_MS);
  }
  if (status === undefined || status >= 500) {
    return FOOTBALL_API_REQUEST_INTERVAL_MS;
  }
  return null;
}

function describeFailure(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response
      ? `HTTP ${error.response.status}`
      : `${error.code ?? 'network error'}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Повідомлення — без тіла відповіді й заголовків запиту (там ключ). */
function toProviderError(
  error: unknown,
  requestPath: string,
): FootballProviderError {
  if (error instanceof FootballProviderError) return error;
  const message = `football-data GET ${requestPath} → ${describeFailure(error)}`;
  if (!axios.isAxiosError(error)) {
    return new FootballProviderError('UNAVAILABLE', message);
  }
  switch (error.response?.status) {
    case 401:
    case 403:
      return new FootballProviderError(
        'AUTH',
        `${message}: перевірте FOOTBALL_API_KEY (токен з кабінету football-data.org) і доступ тарифу до турніру`,
      );
    case 404:
      return new FootballProviderError('NOT_FOUND', message);
    case 429:
      return new FootballProviderError('RATE_LIMITED', message);
    default:
      return new FootballProviderError('UNAVAILABLE', message);
  }
}
