import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response, Request } from 'express';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import {
  LoginThrottle,
  RefreshThrottle,
  RegisterThrottle,
} from '../security/throttling/request-throttling';
import { AuthService } from './auth.service';
import { AuthCookieService, readRefreshToken } from './auth-cookies';
import { CurrentUser, OptionalCurrentUser } from './current-user.decorator';
import {
  AuthUserResponseDto,
  CurrentUserResponseDto,
  LogoutAllResponseDto,
} from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthOptional, AuthRequired } from './guards/access.decorators';
import { RefreshThrottlerGuard } from './guards/refresh-throttler.guard';
import { readSessionClientContext } from './session-client-context';
import { AuthSessionService } from './sessions/auth-session.service';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: AuthSessionService,
    private authCookies: AuthCookieService,
  ) {}

  /**
   * Реєстрація (без входу: сесію створює `login`).
   * @throws {400} Невалідні поля; `Email domain is not allowed` — зарезервований домен
   * @throws {403} EMAIL_BLOCKED — пошта нещодавно видаленого або забаненого акаунта
   * @throws {409} Email already in use
   * @throws {429} TOO_MANY_REQUESTS — понад 5 реєстрацій за 10 хв з IP
   */
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @RegisterThrottle()
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async register(@Body() dto: RegisterDto): Promise<AuthUserResponseDto> {
    const user = await this.authService.register(dto);
    return { message: 'Registered successfully', user };
  }

  /**
   * Вхід: ставить httpOnly cookies сесії (`access_token` — 15 хв, `refresh_token`).
   * @throws {401} Invalid credentials
   * @throws {403} ACCOUNT_LOCKED
   * @throws {429} TOO_MANY_REQUESTS — понад 10 спроб за хвилину з IP або 10 за 15 хв на акаунт
   */
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @LoginThrottle()
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponseDto> {
    const { user, tokens } = await this.authService.login(
      dto,
      readSessionClientContext(req),
      readRefreshToken(req),
    );
    this.authCookies.set(res, tokens);
    return { message: 'Logged in successfully', user };
  }

  /**
   * Вхід в адмінку — лише ADMIN.
   * @remarks Не-ADMIN отримує 403 `ADMIN_ONLY` після перевірки пароля — без токенів і cookies
   * (сесія, з якою користувач уже зайшов на сайт, теж лишається). Ліміт спроб — спільний з `login`.
   * @throws {401} Invalid credentials
   * @throws {403} ADMIN_ONLY, ACCOUNT_LOCKED
   * @throws {429} TOO_MANY_REQUESTS — спільний ліміт з `login`
   */
  @Post('login/admin')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @LoginThrottle()
  @Header('Cache-Control', 'no-store')
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUserResponseDto> {
    const { user, tokens } = await this.authService.login(
      dto,
      readSessionClientContext(req),
      readRefreshToken(req),
      { requiredRole: Role.ADMIN },
    );
    this.authCookies.set(res, tokens);
    return { message: 'Logged in successfully', user };
  }

  /**
   * Оновлення сесії за refresh-cookie: нові cookies (ротація токена).
   * @throws {401} INVALID_REFRESH_TOKEN — сесії немає, вона прострочена чи відкликана (cookies прибрано)
   * @throws {403} ACCOUNT_LOCKED
   * @throws {409} REFRESH_SUPERSEDED — токен щойно оновила інша вкладка: нові cookies вже в браузері, повторіть свій запит
   * @throws {429} TOO_MANY_REQUESTS — понад 30 оновлень за хвилину з IP
   */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(RefreshThrottlerGuard)
  @RefreshThrottle()
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const refreshToken = readRefreshToken(req);
    try {
      const tokens = await this.sessionService.rotateSession(
        refreshToken,
        readSessionClientContext(req),
      );
      this.authCookies.set(res, tokens);
      return { message: 'Session refreshed' };
    } catch (error) {
      // 409 REFRESH_SUPERSEDED — cookies не чіпаємо: інша вкладка вже поставила нові (P2-5).
      // Сесії більше немає — прибираємо мертві cookies, щоб браузер їх не слав.
      // Без refresh-cookie (гість) прибирати нічого, а `Set-Cookie` цієї відповіді,
      // що запізнилась, стер би cookies логіну, який браузер встиг зробити паралельно
      if (
        refreshToken &&
        (error instanceof UnauthorizedException ||
          error instanceof ForbiddenException)
      ) {
        this.authCookies.clear(res);
      }
      throw error;
    }
  }

  /** Вихід на цьому пристрої: сесію відкликано, cookies прибрано. Без сесії — теж 200. */
  // Без guard: access-токен міг прострочитися, а сесію відкликати все одно треба
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    await this.sessionService.endSession(readRefreshToken(req));
    this.authCookies.clear(res);
    return { message: 'Logged out successfully' };
  }

  /** Вихід на всіх пристроях. */
  @Post('logout-all')
  @HttpCode(200)
  @AuthRequired()
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutAllResponseDto> {
    const revokedSessions = await this.sessionService.endAllSessions(user.id);
    this.authCookies.clear(res);
    return { message: 'Logged out on all devices', revokedSessions };
  }

  /**
   * Поточний користувач — відновлення сесії після F5; гість без cookies → `user: null`.
   * @throws {401} Access-токена немає чи він недійсний, але є refresh-cookie: зробіть refresh і повторіть
   */
  @Get('me')
  @AuthOptional()
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async me(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Req() req: Request,
  ): Promise<CurrentUserResponseDto> {
    return {
      user: await this.authService.getSessionUser(
        user?.id,
        readRefreshToken(req) !== undefined,
      ),
    };
  }
}
