import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostRepository {
  constructor(private prisma: PrismaService) {}

  // select визначає які поля повертати — ніколи не тягнемо зайвого
  private readonly postSelect = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    content: true,
    coverImage: true,
    published: true,
    createdAt: true,
    author: {
      select: { id: true, name: true, avatar: true },
    },
  };

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { published: true },
        select: this.postSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where: { published: true } }),
    ]);

    return { posts, total };
  }

  async findBySlug(slug: string) {
    return this.prisma.post.findUnique({
      where: { slug },
      select: {
        ...this.postSelect,
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findAllForAdmin() {
    return this.prisma.post.findMany({
      select: this.postSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreatePostDto, authorId: string) {
    const slug = this.generateSlug(data.title);

    return this.prisma.post.create({
      data: { ...data, slug, authorId },
      select: this.postSelect,
    });
  }

  async update(id: string, data: UpdatePostDto) {
    const updateData = { ...data } as UpdatePostDto & { slug?: string };
    if (data.title) {
      updateData.slug = this.generateSlug(data.title);
    }

    return this.prisma.post.update({
      where: { id },
      data: updateData,
      select: this.postSelect,
    });
  }

  async delete(id: string) {
    return this.prisma.post.delete({ where: { id } });
  }

  async findById(id: string) {
    return this.prisma.post.findUnique({
      where: { id },
      select: this.postSelect,
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      + '-' + Date.now();
  }
}