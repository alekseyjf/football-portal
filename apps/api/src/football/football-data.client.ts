import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Єдиний HTTP-клієнт до football-data.org (axios + логування в dev).
 * Синк і LIVE не викликають axios напряму.
 */
@Injectable()
export class FootballDataClient {
  private readonly log = new Logger(FootballDataClient.name);
  private client: AxiosInstance | null = null;

  assertApiKeyConfigured(): void {
    const key = process.env.FOOTBALL_API_KEY?.trim();
    if (!key) {
      throw new BadRequestException(
        'FOOTBALL_API_KEY не задано — синхронізація недоступна',
      );
    }
    if (/^\d{1,6}$/.test(key)) {
      this.log.warn(
        'FOOTBALL_API_KEY схожий на id змагання. Потрібен токен з кабінету football-data.org.',
      );
    }
  }

  hasApiKey(): boolean {
    return Boolean(process.env.FOOTBALL_API_KEY?.trim());
  }

  private getAxios(): AxiosInstance {
    this.assertApiKeyConfigured();
    const key = process.env.FOOTBALL_API_KEY!.trim();
    if (!this.client) {
      const baseURL =
        process.env.FOOTBALL_API_URL?.trim() ||
        'https://api.football-data.org/v4';
      this.client = axios.create({
        baseURL,
        timeout: 45_000,
        headers: { 'X-Auth-Token': key },
      });
      this.attachDevLogging(this.client);
    }
    return this.client;
  }

  private attachDevLogging(client: AxiosInstance): void {
    const enabled =
      process.env.NODE_ENV === 'development' ||
      process.env.FOOTBALL_HTTP_LOG === 'true';
    if (!enabled) return;

    client.interceptors.request.use((config) => {
      const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
      this.log.log(
        `[football-data] → ${(config.method ?? 'get').toUpperCase()} ${url}`,
      );
      return config;
    });

    client.interceptors.response.use(
      (response) => {
        const url = `${response.config.baseURL ?? ''}${response.config.url ?? ''}`;
        this.log.log(`[football-data] ← ${response.status} ${url}`);
        return response;
      },
      (err: unknown) => {
        if (axios.isAxiosError(err) && err.config) {
          const url = `${err.config.baseURL ?? ''}${err.config.url ?? ''}`;
          this.log.warn(
            `[football-data] ← ${err.response?.status ?? 'ERR'} ${url}`,
          );
        }
        return Promise.reject(err);
      },
    );
  }

  async getJson<T>(path: string): Promise<T> {
    try {
      const { data } = await this.getAxios().get<T>(path);
      return data;
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        const status = e.response?.status;
        const body = e.response?.data;
        this.log.warn(
          `football-data GET ${path} → HTTP ${status ?? 'n/a'} ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body)?.slice(0, 300)}`,
        );
        if (status === 401 || status === 403) {
          throw new BadRequestException(
            'football-data.org відхилив запит (401/403). Перевірте FOOTBALL_API_KEY: має бути API Token з https://www.football-data.org/client/register , а не id змагання.',
          );
        }
        if (status === 429) {
          throw new ServiceUnavailableException(
            'Ліміт запитів football-data.org (429). Зачекайте або зменште частоту синку.',
          );
        }
        throw new ServiceUnavailableException({
          message: 'Помилка football-data.org',
          status,
          detail: body,
        });
      }
      throw e;
    }
  }
}
