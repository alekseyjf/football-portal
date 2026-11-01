import { BadRequestException } from '@nestjs/common';
import { slugifyTitle } from '@football-portal/validation';
import type { ContentLanguages } from '../languages/language.service';
import {
  findTranslationLanguagesError,
  type TranslationLanguagesInput,
} from '../languages/translation-languages';
import type {
  CreatePostData,
  PostEditStateRow,
  PostTranslationInput,
  UpdatePostData,
} from './admin-post.repository';
import type { CreatePostDto } from './dto/create-post.dto';
import type { PostFieldsDto, PostTranslationDto } from './dto/post-fields.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import {
  coverImageTextToStore,
  resolvePostCoverImage,
  type PostCoverImageInput,
  type PostCoverImagePhoto,
} from './post-cover-image';
import { unpinsOnPublicationChange } from './post-pin';
import {
  isSamePublication,
  resolvePostPublication,
  type PostPublication,
} from './post-publication';
import { resolveUpdatedPostSlug } from './post-slug';
import {
  resolvePostSource,
  type PostSourceInput,
  type PostSourceWrite,
} from './post-source';

/*
 * Що записати в новину з запиту редактора — за правилами полів (`resolvePostPublication`, `resolvePostCoverImage`,
 * `resolvePostSource`, `resolveUpdatedPostSlug`). Порушене правило — 400 з його кодом.
 */

export interface PostCreateInput {
  dto: CreatePostDto;
  authorId: string;
  languages: ContentLanguages;
  now: Date;
}

export function postCreateData(input: PostCreateInput): CreatePostData {
  const { dto, authorId, languages, now } = input;
  assertTranslationLanguagesAllowed({
    translations: dto.translations,
    isNew: true,
    // UK — бажана, без неї сайт покаже EN з позначкою (D23)
    required: 'default',
    languages,
  });
  // Переклад default-мови є: без нього перевірка мов вище кидає 400
  const defaultTranslation = dto.translations.find(
    (translation) => translation.languageCode === languages.defaultCode,
  )!;
  const publication = resolvePublicationOrThrow(dto, null, now);
  const coverPhoto = resolveCoverImageOrThrow({
    current: null,
    requested: dto,
    status: publication.status,
    activeLanguageCodes: languages.activeCodes,
  });
  const source = resolveSourceOrThrow({ current: null, requested: dto });
  return {
    // Унікальність не потрібна: новину визначає номер (D24)
    slug: dto.slug ?? slugifyTitle(defaultTranslation.title),
    ...publication,
    coverImageUrl: dto.coverImageUrl,
    coverImageCredit: coverImageTextToStore(dto.coverImageCredit, coverPhoto),
    videoUrl: dto.videoUrl,
    sourceUrl: source.sourceUrl,
    sourceName: source.sourceName,
    authorId,
    translations: dto.translations.map((translation) =>
      toTranslationInput(translation, coverPhoto),
    ),
    tagIds: dto.tagIds,
    clubIds: dto.clubIds,
    competitionIds: dto.competitionIds,
  };
}

/** Мови перекладів у запиті на зміну — до транзакції: стану новини вони не потребують. */
export function assertUpdatedTranslationsAllowed(
  dto: UpdatePostDto,
  languages: ContentLanguages,
): void {
  if (!dto.translations) return;
  assertTranslationLanguagesAllowed({
    translations: dto.translations,
    isNew: false,
    required: 'default',
    languages,
  });
}

export interface PostUpdateInput {
  /** Стан заблокованої новини (`lockEditState`) */
  currentPost: PostEditStateRow;
  dto: UpdatePostDto;
  languages: ContentLanguages;
  now: Date;
}

export function postUpdateData(input: PostUpdateInput): UpdatePostData {
  const { currentPost, dto, languages, now } = input;
  const currentPublication: PostPublication = {
    status: currentPost.status,
    publishedAt: currentPost.publishedAt,
  };
  const publication = resolvePublicationOrThrow(dto, currentPublication, now);
  const coverPhoto = resolveCoverImageOrThrow({
    current: currentPost,
    requested: dto,
    status: publication.status,
    activeLanguageCodes: languages.activeCodes,
  });
  const source = resolveSourceOrThrow({ current: currentPost, requested: dto });
  return {
    // Лише якщо змінюється: інакше правка заголовка з давно відкритої форми
    // перезаписала б статус, який інший адмін встиг змінити (lost update)
    ...(isSamePublication(publication, currentPublication) ? {} : publication),
    // Закріпленою буває лише жива (D56): зняли з публікації чи в архів — закріплення знімається тут же
    unpin: unpinsOnPublicationChange({
      current: currentPublication,
      next: publication,
      now,
    }),
    slug: updatedSlug(currentPost, dto, languages.defaultCode),
    coverImageUrl: dto.coverImageUrl,
    coverImageCredit: coverImageTextToStore(dto.coverImageCredit, coverPhoto),
    videoUrl: dto.videoUrl,
    sourceUrl: source.sourceUrl,
    sourceName: source.sourceName,
    translations: dto.translations?.map((translation) =>
      toTranslationInput(translation, coverPhoto),
    ),
    // Фото змінилось чи прибране — опис попереднього не лишаємо й у перекладах поза запитом
    clearCoverImageAlts: !coverPhoto.isSamePhoto,
    tagIds: dto.tagIds,
    clubIds: dto.clubIds,
    competitionIds: dto.competitionIds,
  };
}

function resolvePublicationOrThrow(
  dto: PostFieldsDto,
  current: PostPublication | null,
  now: Date,
): PostPublication {
  const result = resolvePostPublication({
    current,
    requestedStatus: dto.status,
    // `null` = не передано: `new Date(null)` дав би 1970-01-01 (backdating PUBLISHED)
    requestedPublishedAt:
      dto.publishedAt == null ? undefined : new Date(dto.publishedAt),
    now,
  });
  if (!result.isValid) throw new BadRequestException(result.errorCode);
  return result.publication;
}

/** Опис і підпис обкладинки — за правилом `resolvePostCoverImage` (D44). */
function resolveCoverImageOrThrow(
  input: PostCoverImageInput,
): PostCoverImagePhoto {
  const result = resolvePostCoverImage(input);
  if (!result.isValid) throw new BadRequestException(result.errorCode);
  return {
    hasCoverImage: result.hasCoverImage,
    isSamePhoto: result.isSamePhoto,
  };
}

/** Що записати в адресу й назву джерела — за правилом `resolvePostSource` (D26). */
function resolveSourceOrThrow(input: PostSourceInput): PostSourceWrite {
  const result = resolvePostSource(input);
  if (!result.isValid) throw new BadRequestException(result.errorCode);
  return result.source;
}

/** Мови перекладів — за правилом `findTranslationLanguagesError` (D23, P3-3). */
function assertTranslationLanguagesAllowed(
  input: TranslationLanguagesInput,
): void {
  const errorCode = findTranslationLanguagesError(input);
  if (errorCode) throw new BadRequestException(errorCode);
}

/** Новий slug (D24) або `undefined` — не змінювати. */
function updatedSlug(
  currentPost: PostEditStateRow,
  dto: UpdatePostDto,
  defaultLanguageCode: string,
): string | undefined {
  return resolveUpdatedPostSlug({
    current: {
      slug: currentPost.slug,
      publishedAt: currentPost.publishedAt,
      defaultTitle: currentPost.translations.find(
        (translation) => translation.languageCode === defaultLanguageCode,
      )?.title,
    },
    requestedSlug: dto.slug,
    requestedDefaultTitle: dto.translations?.find(
      (translation) => translation.languageCode === defaultLanguageCode,
    )?.title,
  });
}

function toTranslationInput(
  translation: PostTranslationDto,
  coverPhoto: PostCoverImagePhoto,
): PostTranslationInput {
  return {
    languageCode: translation.languageCode,
    title: translation.title,
    excerpt: translation.excerpt,
    content: translation.content,
    coverImageAlt: coverImageTextToStore(translation.coverImageAlt, coverPhoto),
  };
}
