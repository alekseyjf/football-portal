import type { ContentLanguageChoice } from '../languages/language.service';
import { pickTranslation } from '../languages/translation-fallback';
import type { AdminTagDto, TagDto } from './dto/tag-response.dto';
import type { AdminTagRow, PublicTagRow } from './tag.repository';

/** Тег у публічній відповіді — у списку й у новині: назва мовою запиту → default → slug (D17). */
export function toPublicTag(
  tagRow: PublicTagRow,
  languageChoice: ContentLanguageChoice,
): TagDto {
  return {
    id: tagRow.id,
    slug: tagRow.slug,
    // Тег без назви жодною з двох мов — показуємо slug, а не порожнє місце (D17)
    name:
      pickTranslation(tagRow.translations, languageChoice)?.name ?? tagRow.slug,
  };
}

/**
 * Теги за абеткою назви мовою сторінки (D45). `Intl.Collator`, а не порівняння рядків: за кодами
 * символів українські «Є», «І», «Ї» стали б перед «А», а «Ґ» — після «Я». Однакові назви — за slug-ом.
 */
export function sortTagsByName(
  tags: readonly TagDto[],
  languageCode: string,
): TagDto[] {
  const collator = new Intl.Collator(languageCode);
  return [...tags].sort(
    (first, second) =>
      collator.compare(first.name, second.name) ||
      collator.compare(first.slug, second.slug),
  );
}

export function toAdminTag(tagRow: AdminTagRow): AdminTagDto {
  return {
    id: tagRow.id,
    slug: tagRow.slug,
    translations: tagRow.translations,
    postCount: tagRow._count.posts,
  };
}
