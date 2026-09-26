import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostService } from './post.service';

@Controller('posts')
export class PostController {
  constructor(private postService: PostService) {}

  @Get()
  getPosts(@Query() query: ListPostsQueryDto) {
    return this.postService.getPublicPosts(query);
  }

  // ⚠️ admin/all ОБОВ'ЯЗКОВО перед :slug — інакше NestJS думає що 'admin' це slug
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllForAdmin() {
    return this.postService.getAllForAdmin();
  }

  @Get(':slug')
  getPostBySlug(@Param('slug') slug: string, @Query('lang') lang?: unknown) {
    return this.postService.getPublicPostBySlug(slug, lang);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createPost(@Body() dto: CreatePostDto, @Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return this.postService.createPost(dto, user.id);
  }

  // Лише ADMIN (P3-7): зі `status` в тілі автор без ролі міг би публікувати
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updatePost(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postService.updatePost(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deletePost(@Param('id') id: string) {
    return this.postService.deletePost(id);
  }
}
