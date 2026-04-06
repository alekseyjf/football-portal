import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostRepository {
  constructor(private prisma: PrismaService) {}

  // Базовий select — мета-дані поста + переклад по мові
  private postSelect(lang: string) {
    return {
      id: true,
      slug: true,
      coverImage: true,
      videoUrl: true,
      published: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, avatar: true },
      },
      translations: {
        where: { language: lang },
        select: { title: true, excerpt: true, language: true },
      },
      tags: {
        select: {
          tag: { select: { id: true, name: true, slug: true } },
        },
      },
    };
  }

  async findAll(page: number, limit: number, lang: string) {
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { published: true, deletedAt: null },
        select: this.postSelect(lang),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({
        where: { published: true, deletedAt: null },
      }),
    ]);

    return { posts, total };
  }

  async findBySlug(slug: string, lang: string) {
    return this.prisma.post.findFirst({
      where: { slug, deletedAt: null },
      select: {
        ...this.postSelect(lang),
        // На сторінці поста тягнемо повний контент
        translations: {
          where: { language: lang },
          select: { title: true, excerpt: true, content: true, language: true },
        },
        // Коментарі першого рівня (без replies)
        comments: {
          where: { deletedAt: null, parentId: null },
          select: {
            id: true,
            content: true,
            pinnedAt: true,
            createdAt: true,
            author: { select: { id: true, name: true, avatar: true } },
            // Replies до кожного коментаря
            replies: {
              where: { deletedAt: null },
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: { select: { id: true, name: true, avatar: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          // Спочатку закріплені, потім нові
          orderBy: [{ pinnedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async findAllForAdmin(lang: string) {
    return this.prisma.post.findMany({
      where: { deletedAt: null },
      select: {
        ...this.postSelect(lang),
        // В адмінці показуємо всі переклади
        translations: {
          select: { language: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        published: true,
        deletedAt: true,
        author: { select: { id: true } },
      },
    });
  }

  async create(dto: CreatePostDto, authorId: string) {
    // Slug беремо з англійського перекладу, або першого доступного
    const enTranslation = dto.translations.find(t => t.language === 'en')
      ?? dto.translations[0];
    const slug = this.generateSlug(enTranslation.title);

    return this.prisma.post.create({
      data: {
        slug,
        coverImage: dto.coverImage,
        videoUrl: dto.videoUrl,
        published: dto.published ?? false,
        sourceUrl: dto.sourceUrl,
        authorId,
        // Створюємо переклади через nested write
        translations: {
          create: dto.translations,
        },
        // Прив'язуємо теги якщо є
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map(tagId => ({ tagId })) }
          : undefined,
      },
      select: this.postSelect('en'),
    });
  }

  async update(id: string, dto: UpdatePostDto) {
    return this.prisma.post.update({
      where: { id },
      data: {
        coverImage: dto.coverImage,
        videoUrl: dto.videoUrl,
        published: dto.published,
        // upsert для кожного перекладу — оновить якщо є, створить якщо немає
        translations: dto.translations
          ? {
              upsert: dto.translations.map(t => ({
                where: { postId_language: { postId: id, language: t.language } },
                create: t,
                update: { title: t.title, excerpt: t.excerpt, content: t.content },
              })),
            }
          : undefined,
        // Якщо передали теги — перезаписуємо повністю
        tags: dto.tagIds
          ? {
              deleteMany: {},
              create: dto.tagIds.map(tagId => ({ tagId })),
            }
          : undefined,
      },
      select: this.postSelect('en'),
    });
  }

  async softDelete(id: string) {
    // Soft delete — встановлюємо deletedAt, не видаляємо з БД
    return this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private generateSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-') +
      '-' +
      Date.now()
    );
  }
}