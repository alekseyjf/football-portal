import {
  Body,
  Controller,
  Delete,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthCookieService } from '../../auth/auth-cookies';
import { CurrentUser } from '../../auth/current-user.decorator';
import {
  AdminOnly,
  ApiAuthRequired,
} from '../../auth/guards/access.decorators';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { MessageResponseDto } from '../../common/dto/message-response.dto';
import { PasswordConfirmationThrottle } from '../../security/throttling/request-throttling';
import { DeleteOwnAccountDto } from './dto/delete-own-account.dto';
import { DeletedUserDto } from './dto/deleted-user-response.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
    private authCookies: AuthCookieService,
  ) {}

  /**
   * Видалити свій акаунт (анонімізація; пошту на 30 днів заблоковано для реєстрації).
   * @throws {403} INVALID_PASSWORD; ADMIN_ACCOUNT_NOT_DELETABLE — адмін себе не видаляє
   * @throws {409} ACCOUNT_ALREADY_DELETED
   * @throws {429} TOO_MANY_REQUESTS — понад 5 спроб за 15 хв
   */
  // ⚠️ `me` ОБОВ'ЯЗКОВО перед `:id` — інакше `me` сприймається як id
  @Delete('me')
  // Порядок важливий: ліміт рахується на id користувача, який ставить JwtAuthGuard
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @ApiAuthRequired()
  @PasswordConfirmationThrottle()
  async deleteOwnAccount(
    @Body() dto: DeleteOwnAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    await this.userService.deleteOwnAccount(user.id, dto.password);
    this.authCookies.clear(res);
    return { message: 'Account deleted' };
  }

  /**
   * Видалити акаунт користувача (анонімізація, пошту заблоковано назавжди).
   * @throws {403} ADMIN_ACCOUNT_NOT_DELETABLE — адміна не видаляють
   * @throws {404} USER_NOT_FOUND
   * @throws {409} ACCOUNT_ALREADY_DELETED
   */
  @Delete(':id')
  @AdminOnly()
  async deleteUser(
    @Param('id') targetUserId: string,
    @Body() dto: DeleteUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<DeletedUserDto> {
    await this.userService.deleteUserAsAdmin(targetUserId, admin.id, dto.note);
    return { message: 'User deleted', userId: targetUserId };
  }
}
