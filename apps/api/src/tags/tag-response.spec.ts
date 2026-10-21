import type { ContentLanguageChoice } from '../languages/language.service';
import type { TagDto } from './dto/tag-response.dto';
import { sortTagsByName, toPublicTag } from './tag-response';
import type { PublicTagRow } from './tag.repository';

const UKRAINIAN_PAGE: ContentLanguageChoice = {
  requestedCode: 'uk',
  defaultCode: 'en',
};

function tagRow(translations: PublicTagRow['translations']): PublicTagRow {
  return { id: 'tag-1', slug: 'transfers', translations };
}

function tag(slug: string, name: string): TagDto {
  return { id: slug, slug, name };
}

describe('toPublicTag — назва тегу (D17)', () => {
  it('мовою запиту, без неї — default-мовою, без обох — slug', () => {
    const english = { languageCode: 'en', name: 'Transfers' };
    const ukrainian = { languageCode: 'uk', name: 'Трансфери' };

    expect(toPublicTag(tagRow([english, ukrainian]), UKRAINIAN_PAGE)).toEqual({
      id: 'tag-1',
      slug: 'transfers',
      name: 'Трансфери',
    });
    expect(toPublicTag(tagRow([english]), UKRAINIAN_PAGE).name).toBe(
      'Transfers',
    );
    expect(toPublicTag(tagRow([]), UKRAINIAN_PAGE).name).toBe('transfers');
  });
});

describe('sortTagsByName — порядок публічного списку (D45)', () => {
  it('українською — за українською абеткою (не за кодами символів), назви англійською — після кирилиці', () => {
    const tags = [
      tag('transfers', 'Трансфери'),
      tag('injuries', 'Injuries'),
      tag('euro', 'Євро-2028'),
      tag('derby', 'Дербі'),
      tag('goals', 'Ґоли'),
      tag('analysis', 'Аналітика'),
      tag('games', 'Ігри'),
    ];

    expect(sortTagsByName(tags, 'uk').map(({ name }) => name)).toEqual([
      'Аналітика',
      'Ґоли',
      'Дербі',
      'Євро-2028',
      'Ігри',
      'Трансфери',
      'Injuries',
    ]);
  });

  it('однакові назви — за slug-ом: порядок не залежить від порядку рядків з БД', () => {
    const tags = [tag('var-review', 'VAR'), tag('var', 'VAR')];

    expect(sortTagsByName(tags, 'en').map(({ slug }) => slug)).toEqual([
      'var',
      'var-review',
    ]);
    expect(
      sortTagsByName([...tags].reverse(), 'en').map(({ slug }) => slug),
    ).toEqual(['var', 'var-review']);
  });
});
