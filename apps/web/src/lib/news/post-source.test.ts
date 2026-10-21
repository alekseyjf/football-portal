import { describe, expect, it } from 'vitest';
import { postSourceLink } from './post-source';

describe('Джерело новини: назва або домен (D26)', () => {
  it('назва є — показуємо її, посилання — на адресу', () => {
    expect(
      postSourceLink({
        sourceUrl: 'https://www.bbc.com/sport/football/articles/derby',
        sourceName: 'BBC Sport',
      }),
    ).toEqual({
      label: 'BBC Sport',
      href: 'https://www.bbc.com/sport/football/articles/derby',
    });
  });

  it.each([
    ['https://www.bbc.com/sport/football', 'bbc.com'],
    // Великі літери й порт у домен не потрапляють
    ['https://WWW.BBC.co.uk:8443/sport', 'bbc.co.uk'],
    ['http://theathletic.com/football/', 'theathletic.com'],
    // Лише `www.` на початку — решта домену як є
    ['https://football.www.example.com/', 'football.www.example.com'],
  ])('без назви %s → домен %s', (sourceUrl, label) => {
    expect(postSourceLink({ sourceUrl, sourceName: null })?.label).toBe(label);
  });

  it.each(['javascript:alert(1)', 'ftp://files.example.com/derby.txt', 'not a url'])(
    'адреса %s — без посилання: з назвою — лише назва, без назви — нічого',
    (sourceUrl) => {
      expect(postSourceLink({ sourceUrl, sourceName: 'BBC Sport' })).toEqual({
        label: 'BBC Sport',
        href: null,
      });
      expect(postSourceLink({ sourceUrl, sourceName: null })).toBeNull();
    },
  );

  it('джерела немає — рядка немає', () => {
    expect(postSourceLink({ sourceUrl: null, sourceName: null })).toBeNull();
  });
});
