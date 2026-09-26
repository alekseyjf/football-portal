import {
  Body,
  Controller,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { clearAuthCookies } from '../../auth/auth-cookies';
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
  constructor(private userService: UserService) {}

  // ⚠️ `me` ОБОВ'ЯЗКОВО перед `:id` — інакше `me` сприймається як id
  @Delete('me')
  // Порядок важливий: ліміт рахується на id користувача, який ставить JwtAuthGuard
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @PasswordConfirmationThrottle()
  async deleteOwnAccount(
    @Body() dto: DeleteOwnAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as AuthenticatedUser;
    await this.userService.deleteOwnAccount(user.id, dto.password);
    clearAuthCookies(res);
    return { message: 'Account deleted' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(
    @Param('id') targetUserId: string,
    @Body() dto: DeleteUserDto,
    @Req() req: Request,
  ) {
    const admin = req.user as AuthenticatedUser;
    await this.userService.deleteUserAsAdmin(targetUserId, admin.id, dto.note);
    return { message: 'User deleted', userId: targetUserId };
  }
}
