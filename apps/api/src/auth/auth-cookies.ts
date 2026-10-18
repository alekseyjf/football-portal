import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { API_GLOBAL_PREFIX } from '../app.constants';
import { envConfig } from '../config/env.config';
import type { AppEnv } from '../config/env.schema';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';
import type { AuthTokens } from './sessions/auth-session.service';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Refresh-cookie летить лише на `/auth/*` (refresh, logout, logout-all, me), а не на кожен запит. */
const REFRESH_TOKEN_COOKIE_PATH = `/${API_GLOBAL_PREFIX}/auth`;
/** v4 ставив refresh-JWT на весь сайт; такі cookies прибираємо при login/refresh/logout (P2-7). */
const LEGACY_REFRESH_TOKEN_COOKIE_PATH = '/';
const ACCESS_TOKEN_COOKIE_PATH = '/';

/** Cookies з токенами для відповідей контролерів; `secure` — на проді (локально API на http). */
@Injectable()
export class AuthCookieService {
  /** JS на фронті не бачить токенів; cross-site POST не несе cookies (`lax`). */
  private readonly baseOptions: CookieOptions;

  constructor(@Inject(envConfig.KEY) env: AppEnv) {
    this.baseOptions = {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    };
  }

  set(res: Response, tokens: AuthTokens): void {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...this.baseOptions,
      path: ACCESS_TOKEN_COOKIE_PATH,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.baseOptions,
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    });
    this.clearLegacyRefreshCookie(res);
  }

  /** `clearCookie` спрацьовує лише з тим самим `path`, що й при встановленні. */
  clear(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      ...this.baseOptions,
      path: ACCESS_TOKEN_COOKIE_PATH,
    });
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.baseOptions,
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
    this.clearLegacyRefreshCookie(res);
  }

  private clearLegacyRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.baseOptions,
      path: LEGACY_REFRESH_TOKEN_COOKIE_PATH,
    });
  }
}

/**
 * Якщо в браузері лишився legacy-cookie з `path=/`, браузер надсилає обидва;
 * cookie з довшим `path` іде першим, а `cookie-parser` бере перше входження.
 */
export function readRefreshToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_TOKEN_COOKIE] || undefined;
}

export function readAccessToken(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}
