import { describe, expect, it } from 'vitest';
import type { AdminPostDetail } from '@/lib/api/types';
import { hasPostChanges, toPostFormValues, toUpdatePostRequest } from './postFormEdit';
import { postFormSchemaFor, type PostFormValues } from './postFormSchema';
import { publicationOptionsFor } from './publicationOptions';

const TIME_ZONE = 'Europe/Kyiv';
const COVER_IMAGE_URL = 'https://images.unsplash.com/photo-1?w=1200&h=630&fit=crop&q=80';
const OTHER_COVER_IMAGE_URL = 'https://images.unsplash.com/photo-2?w=1200&h=630&fit=crop&q=80';
/** Відео, як його зберігає API, — канонічне посилання (D54). */
const SAVED_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/** Переклад, як його надсилає форма (без опису фото); у збереженій новині — ще й `coverImageAlt`. */
const ENGLISH = {
  languageCode: 'en',
  title: 'Arsenal beat Chelsea',
  excerpt: 'A late header settled the London derby.',
  content: 'Arsenal came from behind to beat Chelsea 2–1 at the Emirates.',
};
const UKRAINIAN = {
  languageCode: 'uk',
  title: '«Арсенал» обіграв «Челсі»',
  excerpt: 'Пізній гол головою вирішив лондонське дербі.',
  content: '«Арсенал» відіграв гол і переміг «Челсі» 2:1 на «Емірейтс».',
};

/** Чернетка з англійською версією, slug — із заголовка; решта — `overrides`. */
function savedPost(overrides: Partial<AdminPostDetail> = {}): AdminPostDetail {
  return {
    id: 'post-1',
    number: 42,
    slug: 'arsenal-beat-chelsea',
    status: 'DRAFT',
    publishedAt: null,
    isLive: false,
    pinnedAt: null,
    pinnedBy: null,
    coverImageUrl: null,
    coverImageCredit: null,
    videoUrl: null,
    sourceUrl: null,
    sourceName: null,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    author: { id: 'admin-1', name: 'Editor', avatarUrl: null, isDeleted: false },
    translations: [{ ...ENGLISH, coverImageAlt: null }],
    tags: [],
    competitions: [],
    clubs: [],
    ...overrides,
  };
}

const PUBLISHED = { status: 'PUBLISHED', publishedAt: '2026-10-20T10:00:00.000Z', isLive: true } as const;
/** Зв'язки збереженої новини — чипами, як їх віддає API (теги за адресою, клуби за назвою). */
const WITH_RELATIONS = {
  tags: [
    { id: 'tag-transfers', slug: 'transfers', translations: [{ languageCode: 'en', name: 'Transfers' }] },
    { id: 'tag-derby', slug: 'london-derby', translations: [{ languageCode: 'en', name: 'London derby' }] },
  ],
  clubs: [
    { id: 'club-arsenal', slug: 'arsenal', name: 'Arsenal FC', crestUrl: null },
    { id: 'club-chelsea', slug: 'chelsea', name: 'Chelsea FC', crestUrl: null },
  ],
  competitions: [{ id: 'competition-pl', slug: 'PL', name: 'Premier League' }],
};
const WITH_COVER_IMAGE = {
  coverImageUrl: COVER_IMAGE_URL,
  coverImageCredit: 'Jane Doe / Unsplash',
  translations: [
    { ...ENGLISH, coverImageAlt: 'Arsenal players celebrate' },
    { ...UKRAINIAN, coverImageAlt: 'Гравці «Арсенала» святкують' },
  ],
};

/** Тіло `PUT` після правки: `changes` — що редактор змінив у формі збереженої новини. */
function updateFor(post: AdminPostDetail, changes: Partial<PostFormValues>) {
  const saved = toPostFormValues(post, TIME_ZONE);
  return toUpdatePostRequest(saved, { ...saved, ...changes }, TIME_ZONE);
}

describe('toPostFormValues: збережена новина → поля форми', () => {
  it('slug: у чернетки зі slug-ом заголовка поле порожнє (адреса йде за заголовком), інакше — поточний slug', () => {
    expect(toPostFormValues(savedPost(), TIME_ZONE).slug).toBe('');
    expect(toPostFormValues(savedPost({ slug: 'north-london-derby' }), TIME_ZONE).slug).toBe('north-london-derby');
    // З датою публікації адреса зафіксована (D24), навіть коли збігається із заголовком
    expect(toPostFormValues(savedPost(PUBLISHED), TIME_ZONE).slug).toBe('arsenal-beat-chelsea');
  });

  it('статус — як бачить редактор: запланована, чий час настав, — Published; та, що чекає, — з датою в поясі', () => {
    const wentLive = toPostFormValues(
      savedPost({ status: 'SCHEDULED', publishedAt: '2026-10-20T10:00:00.000Z', isLive: true }),
      TIME_ZONE,
    );
    expect(wentLive).toMatchObject({ publication: 'PUBLISHED', scheduledAt: '' });

    const waiting = toPostFormValues(
      savedPost({ status: 'SCHEDULED', publishedAt: '2026-10-26T08:00:00.000Z' }),
      TIME_ZONE,
    );
    expect(waiting).toMatchObject({ publication: 'SCHEDULED', scheduledAt: '2026-10-26T10:00' });
  });

  it('текст, збережений до обрізання (пробіли й переноси по краях), відкривається незміненим: у PUT нічого', () => {
    const post = savedPost({
      ...PUBLISHED,
      translations: [
        { ...ENGLISH, title: `  ${ENGLISH.title} `, content: `${ENGLISH.content}  \nSecond line\n\n`, coverImageAlt: null },
      ],
      sourceUrl: 'https://www.bbc.com/sport/football/articles/abc',
      sourceName: ' BBC Sport ',
    });
    const saved = toPostFormValues(post, TIME_ZONE);
    // Краї прибрано, перенос Markdown усередині (два пробіли в кінці рядка) — на місці
    expect(saved).toMatchObject({
      titleEn: ENGLISH.title,
      contentEn: `${ENGLISH.content}  \nSecond line`,
      sourceName: 'BBC Sport',
    });
    // Форма надсилає значення після схеми — ті самі, що відкрились; інша правка не тягне за собою переклад
    const submitted = postFormSchemaFor({ timeZone: TIME_ZONE, savedValues: saved }).parse(saved);
    expect(toUpdatePostRequest(saved, submitted, TIME_ZONE)).toEqual({});
    expect(toUpdatePostRequest(saved, { ...submitted, sourceName: 'BBC News' }, TIME_ZONE)).toEqual({
      sourceName: 'BBC News',
    });
  });

  it('переклади й обкладинка — у поля своєї мови; мова поза формою (вимкнена) — ні', () => {
    const values = toPostFormValues(
      savedPost({
        ...WITH_COVER_IMAGE,
        translations: [
          ...WITH_COVER_IMAGE.translations,
          { ...ENGLISH, languageCode: 'de', title: 'Arsenal gewinnt', coverImageAlt: null },
        ],
      }),
      TIME_ZONE,
    );
    expect(values).toMatchObject({
      titleEn: ENGLISH.title,
      titleUk: UKRAINIAN.title,
      coverImageAltEn: 'Arsenal players celebrate',
      coverImageAltUk: 'Гравці «Арсенала» святкують',
      coverImageCredit: 'Jane Doe / Unsplash',
    });
    expect(Object.values(values)).not.toContain('Arsenal gewinnt');
  });

  it('зв’язки — id набором: порядок, у якому їх віддав API, не важить', () => {
    const values = toPostFormValues(savedPost(WITH_RELATIONS), TIME_ZONE);
    expect(values).toMatchObject({
      tagIds: ['tag-derby', 'tag-transfers'],
      clubIds: ['club-arsenal', 'club-chelsea'],
      competitionIds: ['competition-pl'],
    });
    const reordered = toPostFormValues(
      savedPost({ ...WITH_RELATIONS, tags: [...WITH_RELATIONS.tags].reverse() }),
      TIME_ZONE,
    );
    expect(reordered.tagIds).toEqual(values.tagIds);
  });
});

describe('toUpdatePostRequest: у PUT — лише змінене', () => {
  it('без змін — порожнє тіло: запит нічого не перезапише', () => {
    const request = updateFor(savedPost({ ...PUBLISHED, ...WITH_COVER_IMAGE, sourceUrl: 'https://bbc.com/a' }), {});
    expect(request).toEqual({});
    expect(hasPostChanges(request)).toBe(false);
  });

  it('змінений переклад — повністю (заголовок, анонс, текст), незмінена мова — ні; доданий український — повністю', () => {
    const post = savedPost({
      ...PUBLISHED,
      translations: [
        { ...ENGLISH, coverImageAlt: null },
        { ...UKRAINIAN, coverImageAlt: null },
      ],
    });
    expect(updateFor(post, { excerptUk: 'Новий анонс про дербі.' })).toEqual({
      translations: [{ ...UKRAINIAN, excerpt: 'Новий анонс про дербі.' }],
    });

    const added = updateFor(savedPost(PUBLISHED), {
      titleUk: UKRAINIAN.title,
      excerptUk: UKRAINIAN.excerpt,
      contentUk: UKRAINIAN.content,
    });
    expect(added.translations).toEqual([UKRAINIAN]);
  });

  it('незмінені зв’язки й відео в запит не йдуть, хоч би що змінилось: переданий масив замінив би зв’язки (D51)', () => {
    const request = updateFor(savedPost({ ...WITH_COVER_IMAGE, ...WITH_RELATIONS, videoUrl: SAVED_VIDEO_URL }), {
      titleEn: 'Arsenal beat Chelsea again',
      coverImageUrl: '',
      sourceUrl: 'https://bbc.com/a',
      publication: 'PUBLISHED',
    });
    for (const fieldName of ['tagIds', 'clubIds', 'competitionIds', 'videoUrl']) {
      expect(request).not.toHaveProperty(fieldName);
    }
  });

  it('відео: збережене — у полі; змінене — нове посилання, очищене — null, те саме — не йде (D54)', () => {
    const post = savedPost({ videoUrl: SAVED_VIDEO_URL });
    expect(toPostFormValues(post, TIME_ZONE).videoUrl).toBe(SAVED_VIDEO_URL);
    expect(updateFor(post, { videoUrl: 'https://youtu.be/aqz-KE-bpKQ' })).toEqual({
      videoUrl: 'https://youtu.be/aqz-KE-bpKQ',
    });
    expect(updateFor(post, { videoUrl: '' })).toEqual({ videoUrl: null });
    expect(updateFor(post, { videoUrl: SAVED_VIDEO_URL })).toEqual({});
    expect(updateFor(savedPost(), { videoUrl: '' })).toEqual({});
  });

  it('зв’язки — набором: той самий в іншому порядку не йде, змінений — увесь набір лише цього виду (D51)', () => {
    const post = savedPost(WITH_RELATIONS);
    expect(updateFor(post, { tagIds: ['tag-transfers', 'tag-derby'] })).toEqual({});
    expect(updateFor(post, { tagIds: ['tag-derby', 'tag-injuries', 'tag-transfers'] })).toEqual({
      tagIds: ['tag-derby', 'tag-injuries', 'tag-transfers'],
    });
    expect(updateFor(post, { clubIds: ['club-arsenal'], competitionIds: ['competition-cl', 'competition-pl'] })).toEqual({
      clubIds: ['club-arsenal'],
      competitionIds: ['competition-cl', 'competition-pl'],
    });
  });

  it('прибрали всі теги — порожній масив: API прибере зв’язки; у новини без зв’язків порожній набір не йде', () => {
    expect(updateFor(savedPost(WITH_RELATIONS), { tagIds: [] })).toEqual({ tagIds: [] });
    expect(updateFor(savedPost(), { tagIds: [], clubIds: [], competitionIds: [] })).toEqual({});
  });

  it('та сама обкладинка: змінений опис — у перекладі, очищений — null; підпис так само (D44)', () => {
    const post = savedPost({ ...PUBLISHED, ...WITH_COVER_IMAGE });
    expect(updateFor(post, { coverImageAltEn: 'Saka celebrates the winner', coverImageAltUk: '' })).toEqual({
      translations: [
        { ...ENGLISH, coverImageAlt: 'Saka celebrates the winner' },
        { ...UKRAINIAN, coverImageAlt: null },
      ],
    });
    expect(updateFor(post, { coverImageCredit: '' })).toEqual({ coverImageCredit: null });
  });

  it('нове фото — адреса разом з описом кожною мовою й підписом, навіть якщо текст той самий: старі API не перенесе', () => {
    const request = updateFor(savedPost({ ...PUBLISHED, ...WITH_COVER_IMAGE }), {
      coverImageUrl: OTHER_COVER_IMAGE_URL,
    });
    expect(request).toEqual({
      coverImageUrl: OTHER_COVER_IMAGE_URL,
      coverImageCredit: 'Jane Doe / Unsplash',
      translations: [
        { ...ENGLISH, coverImageAlt: 'Arsenal players celebrate' },
        { ...UKRAINIAN, coverImageAlt: 'Гравці «Арсенала» святкують' },
      ],
    });
    // Мова без опису нового фото — без перекладу в запиті: API лишить її без опису
    const withoutUkAlt = updateFor(savedPost({ ...WITH_COVER_IMAGE }), {
      coverImageUrl: OTHER_COVER_IMAGE_URL,
      coverImageAltUk: '',
    });
    expect(withoutUkAlt.translations?.map((translation) => translation.languageCode)).toEqual(['en']);
  });

  it('прибрана обкладинка — лише null: опис і підпис API прибере сам', () => {
    const post = savedPost({ ...WITH_COVER_IMAGE });
    // Форма очищає опис і підпис разом з адресою
    expect(
      updateFor(post, { coverImageUrl: '', coverImageAltEn: '', coverImageAltUk: '', coverImageCredit: '' }),
    ).toEqual({ coverImageUrl: null });
  });

  it('джерело: інша адреса — разом з назвою, прибрана — null цілком, та сама — лише змінена назва (D26)', () => {
    const post = savedPost({ sourceUrl: 'https://www.bbc.com/sport/a', sourceName: 'BBC Sport' });
    expect(updateFor(post, { sourceUrl: 'https://www.bbc.com/sport/b' })).toEqual({
      sourceUrl: 'https://www.bbc.com/sport/b',
      sourceName: 'BBC Sport',
    });
    expect(updateFor(post, { sourceUrl: '', sourceName: '' })).toEqual({ sourceUrl: null });
    expect(updateFor(post, { sourceName: '' })).toEqual({ sourceName: null });
    expect(updateFor(post, { sourceName: 'BBC News' })).toEqual({ sourceName: 'BBC News' });
  });

  it('запланована, чий час настав (API: status SCHEDULED, isLive true), — у формі жива: Published / Unpublish, адреса не порожня', () => {
    const wentLive = savedPost({ status: 'SCHEDULED', publishedAt: '2026-10-20T10:00:00.000Z', isLive: true });
    const saved = toPostFormValues(wentLive, TIME_ZONE);
    expect(saved).toMatchObject({ publication: 'PUBLISHED', slug: 'arsenal-beat-chelsea' });
    const options = publicationOptionsFor(wentLive, { now: new Date('2026-10-23T09:00:00.000Z'), timeZone: TIME_ZONE });
    expect(options.map((option) => option.value)).toEqual(['PUBLISHED', 'ARCHIVED']);
    // Очищене поле адреси до PUT не дійде — схема покаже помилку біля поля (D50)
    const context = { timeZone: TIME_ZONE, savedValues: saved, isLive: wentLive.isLive };
    const result = postFormSchemaFor(context).safeParse({ ...saved, slug: '' });
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['slug']);
    // Залишив «Published» — статус у PUT не йде: у БД лишається SCHEDULED з минулою датою, новина й далі на сайті
    expect(updateFor(wentLive, { titleEn: 'Arsenal edge Chelsea' })).not.toHaveProperty('status');
  });

  it('slug: чернетка без явного йде за заголовком; явний не губиться при новому заголовку; змінене поле — нова адреса', () => {
    const newTitle = { titleEn: 'Arsenal edge Chelsea' };
    expect(updateFor(savedPost(), newTitle)).toEqual({
      translations: [{ ...ENGLISH, title: 'Arsenal edge Chelsea' }],
      slug: 'arsenal-edge-chelsea',
    });
    // Інакше API дав би чернетці slug нового заголовка (D24)
    expect(updateFor(savedPost({ slug: 'north-london-derby' }), newTitle).slug).toBe('north-london-derby');
    expect(updateFor(savedPost(PUBLISHED), { slug: 'arsenal-win-derby' }).slug).toBe('arsenal-win-derby');
    // Поле очистили — адреса з англійського заголовка
    expect(updateFor(savedPost({ ...PUBLISHED, slug: 'old-address' }), { slug: '' }).slug).toBe('arsenal-beat-chelsea');
    expect(updateFor(savedPost(PUBLISHED), {})).not.toHaveProperty('slug');
  });

  it('публікація: статус — лише змінений; розклад — з датою в поясі редактора; Publish now і Unpublish — без дати', () => {
    expect(updateFor(savedPost(), { publication: 'PUBLISHED' })).toEqual({ status: 'PUBLISHED' });
    expect(updateFor(savedPost(), { publication: 'SCHEDULED', scheduledAt: '2026-10-26T10:00' })).toEqual({
      status: 'SCHEDULED',
      publishedAt: '2026-10-26T08:00:00.000Z',
    });
    const scheduled = savedPost({ status: 'SCHEDULED', publishedAt: '2026-10-26T08:00:00.000Z' });
    expect(updateFor(scheduled, { scheduledAt: '2026-10-27T10:00' })).toEqual({
      status: 'SCHEDULED',
      publishedAt: '2026-10-27T08:00:00.000Z',
    });
    expect(updateFor(savedPost(PUBLISHED), { publication: 'ARCHIVED' })).toEqual({ status: 'ARCHIVED' });
    // Архівна повертається зі своєю датою — її збереже API
    const archived = savedPost({ ...PUBLISHED, status: 'ARCHIVED', isLive: false });
    expect(updateFor(archived, { publication: 'PUBLISHED' })).toEqual({ status: 'PUBLISHED' });
  });
});
