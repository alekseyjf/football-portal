import { describe, expect, it } from 'vitest';
import { articleImageUrls, COVER_IMAGE_HOSTS, coverImageUrlExample, isAllowedCoverImageUrl } from './cover-image';
import { coverImageUrlSchema } from './forms';

const UNSPLASH_PHOTO = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018';
const PEXELS_PHOTO = 'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg';

describe('Обкладинка — лише з фотобанку зі списку (M1.8.3a)', () => {
  it.each([
    UNSPLASH_PHOTO,
    // Розмір і обрізання — параметрами CDN (editor-guide.md)
    `${UNSPLASH_PHOTO}?w=1200&h=630&fit=crop&q=80`,
    `${PEXELS_PHOTO}?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1`,
    // Хост без регістру: new URL() зводить до малих літер — так само, як браузер і Next
    'https://IMAGES.Unsplash.COM/photo-1574629810360-7efbbe195018',
    // Порт за замовчуванням — та сама адреса: new URL() його прибирає
    'https://images.unsplash.com:443/photo-1574629810360-7efbbe195018',
    // `%2e` у хості — та сама крапка: new URL() розкодовує хост
    'https://images%2Eunsplash.com/photo-1574629810360-7efbbe195018',
  ])('%s — дозволено', (url) => {
    expect(isAllowedCoverImageUrl(url)).toBe(true);
  });

  it.each([
    // Не https
    'http://images.unsplash.com/photo-1574629810360-7efbbe195018',
    'ftp://images.unsplash.com/photo-1574629810360-7efbbe195018',
    // Інший хост: піддомен, «батько», схожий, підставлений через user@host, з крапкою в кінці
    'https://cdn.images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://unsplash.com/photo-1574629810360-7efbbe195018',
    'https://plus.unsplash.com/premium_photo-1661963212517-830bbb7d76fc',
    'https://images.unsplash.com.evil.example/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com@evil.example/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com./photo-1574629810360-7efbbe195018',
    // Логін, пароль чи порт — не адреса фотобанку
    'https://user@images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://user:secret@images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com:8443/photo-1574629810360-7efbbe195018',
    // IP замість назви хоста
    'https://151.101.2.208/photo-1574629810360-7efbbe195018',
    'https://[2a04:4e42::720]/photo-1574629810360-7efbbe195018',
    // Кирилична «і» замість латинської: new URL() дає punycode, і хост уже інший
    'https://іmages.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://xn--mages-m2e.unsplash.com/photo-1574629810360-7efbbe195018',
    // `%2e` у хості не робить з нього інший хост, а в шляху `%70` не розкодовується — шлях не той
    'https://images.unsplash.com%2Eevil.example/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com/%70hoto-1574629810360-7efbbe195018',
    // Хост той, шлях — не фото: аватарка автора, вкладений сегмент, вихід з каталогу через `..` / `%2e%2e`
    'https://images.unsplash.com/profile-1441298803695-accd94000cac',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018/extra',
    'https://images.unsplash.com/photo-1/../profile-1441298803695-accd94000cac',
    'https://images.unsplash.com/photo-1/%2e%2e/profile-1441298803695-accd94000cac',
    'https://images.pexels.com/users/avatars/1/photo.jpeg',
    'https://images.pexels.com/videos/3191572/free-video-3191572.jpg',
    'https://images.pexels.com/photos/46798',
    // Порожній сегмент — не фото (і оптимізатор сайту таку адресу не пропустить)
    'https://images.pexels.com/photos/46798/',
    'https://images.pexels.com/photos//pexels-photo-46798.jpeg',
    'https://images.unsplash.com/photo-',
    // Не адреса
    'images.unsplash.com/photo-1574629810360-7efbbe195018',
    '',
  ])('%s — ні', (url) => {
    expect(isAllowedCoverImageUrl(url)).toBe(false);
  });

  it('приклад адреси кожного фотобанку проходить правило — підказка редактору не бреше', () => {
    for (const host of COVER_IMAGE_HOSTS) {
      expect(isAllowedCoverImageUrl(coverImageUrlExample(host).replaceAll('…', '1'))).toBe(true);
    }
  });

  it('схема форми: та сама перевірка (текст з переліком фотобанків — у мапі адмінки)', () => {
    expect(coverImageUrlSchema.safeParse(` ${UNSPLASH_PHOTO} `)).toEqual({ success: true, data: UNSPLASH_PHOTO });
    const foreign = coverImageUrlSchema.safeParse('https://e2e.test/cover.jpg');
    expect(foreign.success).toBe(false);
    expect(foreign.error?.issues[0].message).toBe('validation.coverImageUrl.notPhotoBank');
    expect(coverImageUrlSchema.safeParse('http://images.unsplash.com/photo-1').error?.issues[0].message).toBe(
      'validation.mediaUrl.notHttps',
    );
  });
});

describe('Обкладинка в JSON-LD статті — обрізання 16:9, 4:3, 1:1 на CDN фотобанку (M1.8.4)', () => {
  it('Unsplash: розмір і обрізання — наші, решта параметрів редактора лишається', () => {
    expect(articleImageUrls(`${UNSPLASH_PHOTO}?w=1200&h=630&fit=max&q=80&fm=jpg`)).toEqual([
      `${UNSPLASH_PHOTO}?w=1200&h=675&fit=crop&q=80&fm=jpg`,
      `${UNSPLASH_PHOTO}?w=1200&h=900&fit=crop&q=80&fm=jpg`,
      `${UNSPLASH_PHOTO}?w=1200&h=1200&fit=crop&q=80&fm=jpg`,
    ]);
  });

  it('Pexels і фото без параметрів', () => {
    expect(articleImageUrls(`${PEXELS_PHOTO}?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1`)).toEqual([
      `${PEXELS_PHOTO}?auto=compress&cs=tinysrgb&w=1200&h=675&dpr=1&fit=crop`,
      `${PEXELS_PHOTO}?auto=compress&cs=tinysrgb&w=1200&h=900&dpr=1&fit=crop`,
      `${PEXELS_PHOTO}?auto=compress&cs=tinysrgb&w=1200&h=1200&dpr=1&fit=crop`,
    ]);
    expect(articleImageUrls(UNSPLASH_PHOTO)[2]).toBe(`${UNSPLASH_PHOTO}?w=1200&h=1200&fit=crop`);
  });

  it('кожне обрізання — ≥ 50 000 пікселів і та сама дозволена адреса фото', () => {
    for (const url of articleImageUrls(UNSPLASH_PHOTO)) {
      const params = new URL(url).searchParams;
      expect(Number(params.get('w')) * Number(params.get('h'))).toBeGreaterThanOrEqual(50_000);
      expect(isAllowedCoverImageUrl(url)).toBe(true);
    }
  });

  it('збережена обкладинка з іншого сайту — як є: її CDN наших параметрів може не знати', () => {
    expect(articleImageUrls('https://e2e.test/news/cover.jpg?w=800')).toEqual(['https://e2e.test/news/cover.jpg?w=800']);
  });
});
