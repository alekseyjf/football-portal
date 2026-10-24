import { describe, expect, it } from 'vitest';
import type { AdminTag } from '@/lib/api/types';
import {
  filterTags,
  findSimilarTags,
  findTagByName,
  searchTags,
  SIMILAR_TAGS_SHOWN,
  sortTagsByTitle,
  sortTagsForList,
  TAG_PICKER_RESULTS_MAX,
} from './tagNames';

function tag(slug: string, nameEn: string | null, nameUk?: string, postCount = 0): AdminTag {
  const translations = [];
  if (nameEn !== null) translations.push({ languageCode: 'en', name: nameEn });
  if (nameUk) translations.push({ languageCode: 'uk', name: nameUk });
  return { id: `id-${slug}`, slug, translations, postCount };
}

const TRANSFERS = tag('transfers', 'Transfers', 'Трансфери');
const TRANSFER_WINDOW = tag('transfer-window', 'Transfer window', 'Трансферне вікно');
const INJURIES = tag('injuries', 'Injuries', 'Травми');
const VAR = tag('var', 'VAR');
const TAGS = [TRANSFERS, TRANSFER_WINDOW, INJURIES, VAR];

const slugsOf = (tags: readonly AdminTag[]) => tags.map((found) => found.slug);

describe('filterTags — фільтр списку тегів', () => {
  it('частина назви будь-якою мовою чи адреси, без регістру', () => {
    expect(slugsOf(filterTags(TAGS, 'TRANSFER'))).toEqual(['transfers', 'transfer-window']);
    expect(slugsOf(filterTags(TAGS, 'травм'))).toEqual(['injuries']);
    expect(slugsOf(filterTags(TAGS, 'ТРАНСФЕРНЕ'))).toEqual(['transfer-window']);
    expect(slugsOf(filterTags(TAGS, 'fer-win'))).toEqual(['transfer-window']);
  });

  it('пробіли по краях і зайві між словами не важать; порожній фільтр — усі теги', () => {
    expect(slugsOf(filterTags(TAGS, '  transfer   window '))).toEqual(['transfer-window']);
    expect(filterTags(TAGS, '   ')).toEqual(TAGS);
  });
});

describe('searchTags — вибір тегу у формі новини (D51)', () => {
  const darwin = tag('darwin-nunez', 'Darwin Núñez');
  const tags = [darwin, ...TAGS];

  it('як фільтр — частина назви будь-якою мовою чи адреси; спершу ті, де з запиту починається назва чи її слово', () => {
    expect(slugsOf(searchTags(tags, 'win').tags)).toEqual(['transfer-window', 'darwin-nunez']);
    expect(slugsOf(searchTags(tags, 'травми').tags)).toEqual(['injuries']);
    expect(slugsOf(searchTags(tags, 'fer-win').tags)).toEqual(['transfer-window']);
  });

  it(`до ${TAG_PICKER_RESULTS_MAX} показаних; total — скільки знайдено всього («уточніть запит»)`, () => {
    const manyTags = Array.from({ length: 25 }, (_, index) => tag(`news-${index}`, `News ${index}`));
    const found = searchTags(manyTags, 'news');
    expect(found.tags).toHaveLength(TAG_PICKER_RESULTS_MAX);
    expect(found.total).toBe(25);
  });

  it('порожній запит — нічого', () => {
    expect(searchTags(tags, '  ')).toEqual({ tags: [], total: 0 });
  });
});

describe('findTagByName — тег з такою назвою вже є: «створити» не пропонуємо', () => {
  it('точна назва будь-якою мовою — без регістру й зайвих пробілів; частина назви — ні', () => {
    expect(findTagByName(TAGS, '  transfer   WINDOW ')?.slug).toBe('transfer-window');
    expect(findTagByName(TAGS, 'ТРАВМИ')?.slug).toBe('injuries');
    expect(findTagByName(TAGS, 'Transfer')).toBeUndefined();
  });
});

describe('findSimilarTags — схожі наявні теги для нового (D51)', () => {
  it('назва наявного містить введену: «Transfer» → «Transfers», «Transfer window»', () => {
    expect(slugsOf(findSimilarTags(TAGS, ['transfer', '']))).toEqual(['transfers', 'transfer-window']);
  });

  it('введена містить назву наявного цілими словами: «Arsenal transfers» → «Transfers», але «Varane» — не «VAR»', () => {
    expect(slugsOf(findSimilarTags(TAGS, ['Arsenal transfers', '']))).toEqual(['transfers']);
    expect(slugsOf(findSimilarTags(TAGS, ['VAR decisions', '']))).toEqual(['var']);
    expect(findSimilarTags(TAGS, ['Varane', ''])).toEqual([]);
  });

  it('обома мовами: українська назва нового знаходить тег за українською назвою', () => {
    expect(slugsOf(findSimilarTags(TAGS, ['', 'травми гравців']))).toEqual(['injuries']);
    expect(slugsOf(findSimilarTags(TAGS, ['Squad news', 'Трансфери']))).toEqual(['transfers']);
  });

  it('введене коротше за назву тегу (2) чи порожнє — не порівнюємо', () => {
    expect(findSimilarTags(TAGS, ['t', ' '])).toEqual([]);
  });

  it(`не більше ${SIMILAR_TAGS_SHOWN}`, () => {
    const manyTags = Array.from({ length: 8 }, (_, index) => tag(`transfers-${index}`, `Transfers ${index}`));
    expect(findSimilarTags(manyTags, ['transfers', ''])).toHaveLength(SIMILAR_TAGS_SHOWN);
  });
});

describe('sortTagsByTitle', () => {
  it('за англійською назвою, а не за адресою: явна адреса не зсуває тег у списку', () => {
    const groups = tag('ucl-groups', 'Champions League groups');
    const apple = tag('zz-apple', 'Apple');
    expect(slugsOf(sortTagsByTitle([groups, TRANSFERS, apple]))).toEqual(['zz-apple', 'ucl-groups', 'transfers']);
  });

  it('без англійської назви — за адресою; однакові назви — за адресою', () => {
    const noName = tag('derby', null);
    const twin = tag('transfers-2', 'Transfers');
    expect(slugsOf(sortTagsByTitle([twin, TRANSFERS, noName]))).toEqual(['derby', 'transfers', 'transfers-2']);
  });
});

describe('sortTagsForList — порядок списку тегів', () => {
  const popular = tag('transfers', 'Transfers', 'Трансфери', 12);
  const unusedB = tag('var', 'VAR', 'ВАР', 0);
  const single = tag('derby', 'Derby', 'Дербі', 1);
  const unusedA = tag('analysis', 'Analysis', 'Аналітика', 0);
  const tags = [popular, unusedB, single, unusedA];

  it('за назвою — за замовчуванням', () => {
    expect(slugsOf(sortTagsForList(tags, 'name'))).toEqual(['analysis', 'derby', 'transfers', 'var']);
  });

  it('за кількістю новин: найбільше — першими; найменше — першими (теги без новин зверху)', () => {
    expect(slugsOf(sortTagsForList(tags, 'posts-desc'))).toEqual(['transfers', 'derby', 'analysis', 'var']);
    expect(slugsOf(sortTagsForList(tags, 'posts-asc'))).toEqual(['analysis', 'var', 'derby', 'transfers']);
  });

  it('однакова кількість — за назвою, в обох напрямках', () => {
    expect(slugsOf(sortTagsForList([unusedB, unusedA], 'posts-desc'))).toEqual(['analysis', 'var']);
    expect(slugsOf(sortTagsForList([unusedB, unusedA], 'posts-asc'))).toEqual(['analysis', 'var']);
  });
});
