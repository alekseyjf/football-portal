import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';

@Controller('posts')
export class PostController {
  constructor(private postService: PostService) {}

  @Get()
  getPosts(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('lang') lang = 'en',
  ) {
    return this.postService.getPosts(+page, +limit, lang);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getAllForAdmin(@Query('lang') lang = 'en') {
    return this.postService.getAllForAdmin(lang);
  }

  // ⚠️ admin/all ОБОВ'ЯЗКОВО перед :slug — інакше NestJS думає що 'admin' це slug
  @Get(':slug')
  getPostBySlug(
    @Param('slug') slug: string,
    @Query('lang') lang = 'en',
  ) {
    return this.postService.getPostBySlug(slug, lang);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createPost(@Body() dto: CreatePostDto, @Req() req: Request) {
    const user = req.user as { id: string; role: string };
    return this.postService.createPost(dto, user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string; role: string };
    return this.postService.updatePost(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deletePost(@Param('id') id: string) {
    return this.postService.deletePost(id);
  }
}