import {
  Body,
  Controller,
  Delete,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { AuthCookieService } from '../../auth/auth-cookies';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/guards/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { PasswordConfirmationThrottle } from '../../security/throttling/request-throttling';
import { DeleteOwnAccountDto } from './dto/delete-own-account.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(
    private userService: UserService,
    private authCookies: AuthCookieService,
  ) {}

  // ⚠️ `me` ОБОВ'ЯЗКОВО перед `:id` — інакше `me` сприймається як id
  @Delete('me')
  // Порядок важливий: ліміт рахується на id користувача, який ставить JwtAuthGuard
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @PasswordConfirmationThrottle()
  async deleteOwnAccount(
    @Body() dto: DeleteOwnAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.userService.deleteOwnAccount(user.id, dto.password);
    this.authCookies.clear(res);
    return { message: 'Account deleted' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(
    @Param('id') targetUserId: string,
    @Body() dto: DeleteUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    await this.userService.deleteUserAsAdmin(targetUserId, admin.id, dto.note);
    return { message: 'User deleted', userId: targetUserId };
  }
}
