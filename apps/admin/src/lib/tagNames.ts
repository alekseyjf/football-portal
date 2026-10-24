import { TAG_NAME_MIN_LENGTH } from '@football-portal/validation';
import type { AdminTag } from '@/lib/api/types';

/** Скільки схожих тегів показує форма нового тегу: далі редактор уточнює назву. */
export const SIMILAR_TAGS_SHOWN = 5;
/** Скільки знайдених тегів показує вибір у формі новини: більше знайшлося — «уточніть запит». */
export const TAG_PICKER_RESULTS_MAX = 20;

/** Що правилам нижче треба від тегу: адреса й назви всіма мовами — є і в `AdminTag`, і в чипі тегу новини. */
type TagNames = Pick<AdminTag, 'slug' | 'translations'>;

/** Назва тегу мовою; немає — `undefined`. */
export function tagNameIn(tag: TagNames, languageCode: string): string | undefined {
  return tag.translations.find((translation) => translation.languageCode === languageCode)?.name;
}

/** Назва тегу в адмінці — англійська (обов'язкова, D45); без неї — адреса. */
export function tagTitle(tag: TagNames): string {
  return tagNameIn(tag, 'en') ?? tag.slug;
}

/** Скільки новин з тегом — будь-якого статусу, і чернеток (D45). */
export function postCountLabel(postCount: number): string {
  if (postCount === 0) return 'no posts';
  return postCount === 1 ? '1 post' : `${postCount} posts`;
}

const ENGLISH_COLLATOR = new Intl.Collator('en');

/**
 * Теги за англійською назвою — так їх шукає редактор; однакові — за адресою. API віддає їх за адресою, а явна
 * адреса (`ucl-groups` у «Champions League groups») стоїть не там, де назва.
 */
export function sortTagsByTitle<Tag extends TagNames>(tags: readonly Tag[]): Tag[] {
  return [...tags].sort(
    (first, second) =>
      ENGLISH_COLLATOR.compare(tagTitle(first), tagTitle(second)) || ENGLISH_COLLATOR.compare(first.slug, second.slug),
  );
}

/** Порядок списку тегів: за назвою — як шукає редактор; за кількістю новин — щоб знайти теги без новин. */
export type TagListOrder = 'name' | 'posts-desc' | 'posts-asc';

/** Список тегів у вибраному порядку; однакова кількість новин — за назвою. */
export function sortTagsForList<Tag extends TagNames & Pick<AdminTag, 'postCount'>>(
  tags: readonly Tag[],
  order: TagListOrder,
): Tag[] {
  const tagsByTitle = sortTagsByTitle(tags);
  if (order === 'name') return tagsByTitle;
  const direction = order === 'posts-desc' ? -1 : 1;
  // `sort` стабільне: теги з однаковою кількістю лишаються за назвою
  return tagsByTitle.sort((first, second) => direction * (first.postCount - second.postCount));
}

/** Текст для порівняння: без регістру, пробіли між словами — по одному. */
function normalizeName(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Слова назви поспіль, у рамці з пробілів: літери й цифри будь-якої мови, решта — межа слова. */
function framedWords(text: string): string {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.length > 0 ? ` ${words.join(' ')} ` : '';
}

/** Фільтр списку тегів: частина назви будь-якою мовою чи адреси, без регістру; порожній — усі. */
export function filterTags<Tag extends TagNames>(tags: readonly Tag[], query: string): Tag[] {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return [...tags];
  return tags.filter(
    (tag) =>
      tag.slug.includes(normalizedQuery) ||
      tag.translations.some((translation) => normalizeName(translation.name).includes(normalizedQuery)),
  );
}

/**
 * Вибір тегу у формі новини (D51): теги, чия назва будь-якою мовою чи адреса містить запит (як у фільтрі списку), —
 * спершу ті, де з нього починається назва, слово назви чи адреса («win» → «Transfer window» раніше за «Darwin»), далі
 * за назвою; до `limit`. `total` — скільки знайдено всього: більше за показані — «уточніть запит».
 */
export function searchTags<Tag extends TagNames>(
  tags: readonly Tag[],
  query: string,
  limit = TAG_PICKER_RESULTS_MAX,
): { tags: Tag[]; total: number } {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return { tags: [], total: 0 };
  const isPrefixMatch = (tag: Tag) =>
    tag.slug.startsWith(normalizedQuery) ||
    tag.translations.some((translation) => ` ${normalizeName(translation.name)}`.includes(` ${normalizedQuery}`));
  const found = sortTagsByTitle(filterTags(tags, normalizedQuery));
  const ranked = [...found.filter(isPrefixMatch), ...found.filter((tag) => !isPrefixMatch(tag))];
  return { tags: ranked.slice(0, limit), total: ranked.length };
}

/**
 * Тег з точно такою назвою будь-якою мовою — без регістру й зайвих пробілів. Є такий — вибір його й пропонує, а не
 * «створити тег» (D51).
 */
export function findTagByName<Tag extends TagNames>(tags: readonly Tag[], name: string): Tag | undefined {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return undefined;
  return tags.find((tag) => tag.translations.some((translation) => normalizeName(translation.name) === normalizedName));
}

/**
 * Наявні теги, схожі на назви нового (D51), — щоб не завести другий тег тієї самої теми. Схожий — його назва будь-якою
 * мовою містить введену («Transfer» → «Transfers») або введена містить її цілими словами («Arsenal transfers» →
 * «Transfers», але «Varane» — не «VAR»). Без регістру, назви обома мовами; введене коротше за назву тегу не порівнюємо.
 */
export function findSimilarTags<Tag extends TagNames>(
  tags: readonly Tag[],
  typedNames: readonly string[],
  limit = SIMILAR_TAGS_SHOWN,
): Tag[] {
  const typedTexts = typedNames.map(normalizeName).filter((name) => name.length >= TAG_NAME_MIN_LENGTH);
  if (typedTexts.length === 0) return [];
  const typedWordTexts = typedTexts.map(framedWords);
  const isSimilarName = (existingName: string) => {
    const existingText = normalizeName(existingName);
    const existingWords = framedWords(existingName);
    return (
      typedTexts.some((typedText) => existingText.includes(typedText)) ||
      (existingWords !== '' && typedWordTexts.some((typedWords) => typedWords.includes(existingWords)))
    );
  };
  return tags.filter((tag) => tag.translations.some((translation) => isSimilarName(translation.name))).slice(0, limit);
}
