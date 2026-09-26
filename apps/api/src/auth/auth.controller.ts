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
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import {
  LoginThrottle,
  RefreshThrottle,
  RegisterThrottle,
} from '../security/throttling/request-throttling';
import { AuthService } from './auth.service';
import {
  clearAuthCookies,
  readRefreshToken,
  setAuthCookies,
} from './auth-cookies';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { readSessionClientContext } from './session-client-context';
import { AuthSessionService } from './sessions/auth-session.service';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: AuthSessionService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @RegisterThrottle()
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return { message: 'Registered successfully', user };
  }

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
  ) {
    const { user, tokens } = await this.authService.login(
      dto,
      readSessionClientContext(req),
      readRefreshToken(req),
    );
    setAuthCookies(res, tokens);
    return { message: 'Logged in successfully', user };
  }

  /**
   * 409 `REFRESH_SUPERSEDED` — cookies не чіпаємо: інша вкладка вже поставила нові,
   * клієнт просто повторює свій запит (P2-5).
   */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @RefreshThrottle()
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.sessionService.rotateSession(
        readRefreshToken(req),
        readSessionClientContext(req),
      );
      setAuthCookies(res, tokens);
      return { message: 'Session refreshed' };
    } catch (error) {
      // Сесії більше немає — прибираємо мертві cookies, щоб браузер їх не слав.
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        clearAuthCookies(res);
      }
      throw error;
    }
  }

  /** Без guard: access-токен міг прострочитися, а сесію відкликати все одно треба. */
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessionService.endSession(readRefreshToken(req));
    clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as AuthenticatedUser;
    const revokedSessions = await this.sessionService.endAllSessions(user.id);
    clearAuthCookies(res);
    return { message: 'Logged out on all devices', revokedSessions };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  // Відповідь з персональними даними / токенами — не кешувати (браузер, проксі)
  @Header('Cache-Control', 'no-store')
  async me(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return { user: await this.authService.getCurrentUser(user.id) };
  }
}
