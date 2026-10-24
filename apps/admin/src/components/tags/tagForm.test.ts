import { describe, expect, it } from 'vitest';
import type { AdminTag } from '@/lib/api/types';
import { newTagFormValues, toCreateTagRequest, toTagNamesFormValues, toUpdateTagRequest } from './tagForm';

const SAVED = { nameEn: 'Transfers', nameUk: 'Трансфери' };

describe('новий тег з пошуку у формі новини (D51)', () => {
  it('введене — назвою мовою свого письма: латиницею — англійська, з кирилицею — українська; адреса — з англійської', () => {
    expect(newTagFormValues('  Transfer   gossip ')).toEqual({ nameEn: 'Transfer gossip', nameUk: '', slug: '' });
    expect(newTagFormValues('Травми')).toEqual({ nameEn: '', nameUk: 'Травми', slug: '' });
    // Змішане письмо — українська: латиницею в ній бувають абревіатури
    expect(newTagFormValues('Рішення VAR')).toEqual({ nameEn: '', nameUk: 'Рішення VAR', slug: '' });
  });
});

describe('тіло POST /tags', () => {
  it('обидві назви (D51); порожня адреса не йде — API візьме її з англійської назви (D45)', () => {
    expect(toCreateTagRequest({ nameEn: 'Transfers', nameUk: 'Трансфери', slug: '' })).toEqual({
      translations: [
        { languageCode: 'en', name: 'Transfers' },
        { languageCode: 'uk', name: 'Трансфери' },
      ],
    });
  });

  it('вписана адреса — йде', () => {
    expect(toCreateTagRequest({ nameEn: 'Champions League groups', nameUk: 'Групи ЛЧ', slug: 'ucl-groups' })).toEqual({
      translations: [
        { languageCode: 'en', name: 'Champions League groups' },
        { languageCode: 'uk', name: 'Групи ЛЧ' },
      ],
      slug: 'ucl-groups',
    });
  });
});

describe('тіло PUT /tags/{id} — лише змінені назви (D50)', () => {
  it('нічого не змінилось — запиту немає', () => {
    expect(toUpdateTagRequest(SAVED, { ...SAVED })).toBeNull();
  });

  it('змінена одна мова — лише вона: незмінена не перезапише правку іншого адміна', () => {
    expect(toUpdateTagRequest(SAVED, { ...SAVED, nameEn: 'Transfer news' })).toEqual({
      translations: [{ languageCode: 'en', name: 'Transfer news' }],
    });
    expect(toUpdateTagRequest(SAVED, { ...SAVED, nameUk: 'Трансферні новини' })).toEqual({
      translations: [{ languageCode: 'uk', name: 'Трансферні новини' }],
    });
  });

  it('тег без української назви (в обхід API) — додана йде', () => {
    expect(toUpdateTagRequest({ nameEn: 'VAR', nameUk: '' }, { nameEn: 'VAR', nameUk: 'Відеоповтори' })).toEqual({
      translations: [{ languageCode: 'uk', name: 'Відеоповтори' }],
    });
  });
});

describe('поля перейменування', () => {
  it('назви збереженого тегу без країв; без української (в обхід API) — порожнє поле, яке форма вимагатиме', () => {
    const tag: AdminTag = {
      id: 'tag-1',
      slug: 'transfers',
      translations: [{ languageCode: 'en', name: ' Transfers  ' }],
      postCount: 3,
    };
    expect(toTagNamesFormValues(tag)).toEqual({ nameEn: 'Transfers', nameUk: '' });
  });
});
