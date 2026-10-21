import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  publicPostWhere,
  type PublicPostScope,
} from '../posts/post-visibility';
import { PrismaService } from '../prisma/prisma.service';

/** Тег у публічній відповіді — у списку тегів і в новині: назви лише запитаною й default-мовою. */
export function publicTagSelect(languageCodes: string[]) {
  return {
    id: true,
    slug: true,
    translations: {
      where: { languageCode: { in: languageCodes } },
      select: { languageCode: true, name: true },
    },
  } satisfies Prisma.TagSelect;
}

const ADMIN_TAG_SELECT = {
  id: true,
  slug: true,
  // В адмінці — усі мови: видно, якої назви бракує
  translations: {
    select: { languageCode: true, name: true },
    orderBy: { language: { sortOrder: 'asc' } },
  },
  // Видалення тегу прибере його з усіх цих новин, і з чернеток теж; видалені (soft delete) не рахуємо
  _count: { select: { posts: { where: { post: { deletedAt: null } } } } },
} satisfies Prisma.TagSelect;

export type PublicTagRow = Prisma.TagGetPayload<{
  select: ReturnType<typeof publicTagSelect>;
}>;
export type AdminTagRow = Prisma.TagGetPayload<{
  select: typeof ADMIN_TAG_SELECT;
}>;

export interface TagTranslationInput {
  languageCode: string;
  name: string;
}

@Injectable()
export class TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Теги, у яких є хоч одна новина зі стрічки — за тим самим правилом, що й `GET /posts`. */
  findWithPublicPosts(
    scope: PublicPostScope,
    languageCodes: string[],
  ): Promise<PublicTagRow[]> {
    return this.prisma.tag.findMany({
      where: { posts: { some: { post: publicPostWhere(scope) } } },
      select: publicTagSelect(languageCodes),
    });
  }

  findBySlug(
    slug: string,
    languageCodes: string[],
  ): Promise<PublicTagRow | null> {
    return this.prisma.tag.findUnique({
      where: { slug },
      select: publicTagSelect(languageCodes),
    });
  }

  findAllForAdmin(): Promise<AdminTagRow[]> {
    return this.prisma.tag.findMany({
      select: ADMIN_TAG_SELECT,
      orderBy: { slug: 'asc' },
    });
  }

  /** Зайнятий slug → `P2002` (сервіс віддає 409). */
  create(data: {
    slug: string;
    translations: TagTranslationInput[];
  }): Promise<AdminTagRow> {
    return this.prisma.tag.create({
      data: { slug: data.slug, translations: { create: data.translations } },
      select: ADMIN_TAG_SELECT,
    });
  }

  /** Назви — upsert за мовою, інших мов не чіпаємо. Тегу немає → `P2025` (сервіс віддає 404). */
  update(
    id: string,
    translations: TagTranslationInput[],
  ): Promise<AdminTagRow> {
    return this.prisma.tag.update({
      where: { id },
      data: {
        translations: {
          upsert: translations.map((translation) => ({
            where: {
              tagId_languageCode: {
                tagId: id,
                languageCode: translation.languageCode,
              },
            },
            create: translation,
            update: { name: translation.name },
          })),
        },
      },
      select: ADMIN_TAG_SELECT,
    });
  }

  /** Фізично: зв'язки з новинами (`PostTag`) і назви БД видаляє каскадом. `false` — тегу вже немає. */
  async delete(id: string): Promise<boolean> {
    const { count } = await this.prisma.tag.deleteMany({ where: { id } });
    return count === 1;
  }
}
