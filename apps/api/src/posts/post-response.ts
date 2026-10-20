import type { ContentLanguageChoice } from '../languages/language.service';
import { toPublicAuthor } from '../users/public-author';
import type { AdminPostDto } from './dto/admin-post-response.dto';
import type {
  PostDetailDto,
  PostSummaryDto,
  PostTagDto,
} from './dto/post-response.dto';
import { isPostLive } from './post-visibility';
import type {
  AdminPostRow,
  PostDetailRow,
  PostSummaryRow,
} from './post.repository';

/*
 * Форма відповідей постів (Rule 5): рядок Prisma → response DTO. Пост у стрічці — переклад уже
 * розгорнуто з fallback на default-мову (P3-4); `resolvedLanguage` ≠ запитаній → UI показує
 * «переклад недоступний».
 */

/** Запитана мова → default (розділ 8). */
function pickTranslation<Translation extends { languageCode: string }>(
  translations: Translation[],
  languageChoice: ContentLanguageChoice,
): Translation | undefined {
  return (
    translations.find(
      (translation) =>
        translation.languageCode === languageChoice.requestedCode,
    ) ??
    translations.find(
      (translation) => translation.languageCode === languageChoice.defaultCode,
    )
  );
}

function requireTranslation<Translation extends { languageCode: string }>(
  postRow: { id: string; translations: Translation[] },
  languageChoice: ContentLanguageChoice,
): Translation {
  const translation = pickTranslation(postRow.translations, languageChoice);
  if (!translation) {
    // Публічні запити фільтрують «є переклад default-мови» (P3-5) — сюди не потрапляємо
    throw new Error(`Post ${postRow.id} has no default-language translation`);
  }
  return translation;
}

/** Живий пост завжди має дату (P3-1, CHECK `Post_published_has_date_check`). */
function requirePublishedAt(postRow: {
  id: string;
  publishedAt: Date | null;
}): Date {
  if (!postRow.publishedAt) {
    throw new Error(`Live post ${postRow.id} has no publishedAt`);
  }
  return postRow.publishedAt;
}

function toTagView(
  tagLink: PostSummaryRow['tags'][number],
  languageChoice: ContentLanguageChoice,
): PostTagDto {
  const { tag } = tagLink;
  return {
    id: tag.id,
    slug: tag.slug,
    // Тег без перекладу жодною з двох мов — показуємо slug, а не порожнє місце (D17)
    name: pickTranslation(tag.translations, languageChoice)?.name ?? tag.slug,
  };
}

export function toPublicPostSummary(
  postRow: PostSummaryRow,
  languageChoice: ContentLanguageChoice,
): PostSummaryDto {
  const translation = requireTranslation(postRow, languageChoice);
  return {
    id: postRow.id,
    number: postRow.number,
    slug: postRow.slug,
    publishedAt: requirePublishedAt(postRow),
    coverImageUrl: postRow.coverImageUrl,
    coverImageAlt: translation.coverImageAlt,
    resolvedLanguage: translation.languageCode,
    title: translation.title,
    excerpt: translation.excerpt,
    author: toPublicAuthor(postRow.author),
    tags: postRow.tags.map((tagLink) => toTagView(tagLink, languageChoice)),
  };
}

export function toPublicPostDetail(
  postRow: PostDetailRow,
  languageChoice: ContentLanguageChoice,
  availableLanguages: string[],
): PostDetailDto {
  const translation = requireTranslation(postRow, languageChoice);
  return {
    ...toPublicPostSummary(postRow, languageChoice),
    content: translation.content,
    coverImageCredit: postRow.coverImageCredit,
    videoUrl: postRow.videoUrl,
    sourceUrl: postRow.sourceUrl,
    availableLanguages,
    competitions: postRow.competitions.map(
      (competitionLink) => competitionLink.competition,
    ),
    clubs: postRow.clubs.map((clubLink) => clubLink.club),
  };
}

export function toAdminPostView(
  postRow: AdminPostRow,
  now: Date,
): AdminPostDto {
  return {
    id: postRow.id,
    number: postRow.number,
    slug: postRow.slug,
    status: postRow.status,
    publishedAt: postRow.publishedAt,
    isLive: isPostLive(postRow, now),
    coverImageUrl: postRow.coverImageUrl,
    createdAt: postRow.createdAt,
    updatedAt: postRow.updatedAt,
    author: toPublicAuthor(postRow.author),
    translations: postRow.translations,
  };
}
