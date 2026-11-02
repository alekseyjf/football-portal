import { PostStatus } from '@prisma/client';
import {
  coverImageTextToStore,
  resolvePostCoverImage,
  type PostCoverImagePhoto,
  type PostCoverImageRequest,
  type PostCoverImageState,
} from './post-cover-image';

const COVER_URL =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018';
const OTHER_COVER_URL =
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg';
/** Обкладинка не з фотобанку зі списку — як у новин, збережених до M1.8.3a */
const FOREIGN_COVER_URL = 'https://news.example/photos/derby.jpg';
const CREDIT = 'Stuart MacFarlane / Getty Images';
const ALT_EN = 'Arsenal players celebrate the winning goal';
const ALT_UK = 'Гравці «Арсенала» святкують переможний гол';
/** Як у БД: `en` — default, `uk` — увімкнена */
const ACTIVE_LANGUAGE_CODES: ReadonlySet<string> = new Set(['en', 'uk']);

/** Обкладинка з описом обома мовами й підписом — і як збережений стан, і як тіло запиту. */
const COMPLETE_COVER: PostCoverImageState = {
  coverImageUrl: COVER_URL,
  coverImageCredit: CREDIT,
  translations: [
    { languageCode: 'en', coverImageAlt: ALT_EN },
    { languageCode: 'uk', coverImageAlt: ALT_UK },
  ],
};

const SAME_PHOTO: PostCoverImagePhoto = {
  hasCoverImage: true,
  isSamePhoto: true,
};
const NEW_PHOTO: PostCoverImagePhoto = {
  hasCoverImage: true,
  isSamePhoto: false,
};

function createPost(requested: PostCoverImageRequest, status: PostStatus) {
  return resolvePostCoverImage({
    current: null,
    requested,
    status,
    activeLanguageCodes: ACTIVE_LANGUAGE_CODES,
  });
}

function updatePost(
  current: PostCoverImageState,
  requested: PostCoverImageRequest,
  status: PostStatus = PostStatus.PUBLISHED,
) {
  return resolvePostCoverImage({
    current,
    requested,
    status,
    activeLanguageCodes: ACTIVE_LANGUAGE_CODES,
  });
}

describe('resolvePostCoverImage — нова новина', () => {
  it.each([PostStatus.PUBLISHED, PostStatus.SCHEDULED])(
    '%s з обкладинкою, описом кожною мовою й підписом — можна',
    (status) => {
      expect(createPost(COMPLETE_COVER, status)).toEqual({
        isValid: true,
        ...NEW_PHOTO,
      });
    },
  );

  it.each([PostStatus.PUBLISHED, PostStatus.SCHEDULED])(
    '%s без опису українською — COVER_IMAGE_ALT_REQUIRED: опис потрібен у кожному перекладі',
    (status) => {
      const requested: PostCoverImageRequest = {
        ...COMPLETE_COVER,
        translations: [
          { languageCode: 'en', coverImageAlt: ALT_EN },
          { languageCode: 'uk' },
        ],
      };
      expect(createPost(requested, status)).toEqual({
        isValid: false,
        errorCode: 'COVER_IMAGE_ALT_REQUIRED',
      });
    },
  );

  it('опублікована без підпису автора фото — COVER_IMAGE_CREDIT_REQUIRED', () => {
    const requested = { ...COMPLETE_COVER, coverImageCredit: undefined };
    expect(createPost(requested, PostStatus.PUBLISHED)).toEqual({
      isValid: false,
      errorCode: 'COVER_IMAGE_CREDIT_REQUIRED',
    });
  });

  it('чернетка з обкладинкою може бути без опису й підпису', () => {
    const requested = {
      coverImageUrl: COVER_URL,
      translations: [{ languageCode: 'en' }],
    };
    expect(createPost(requested, PostStatus.DRAFT)).toEqual({
      isValid: true,
      ...NEW_PHOTO,
    });
  });

  it('без обкладинки — можна, і фото немає', () => {
    const requested = { ...COMPLETE_COVER, coverImageUrl: undefined };
    expect(createPost(requested, PostStatus.PUBLISHED)).toEqual({
      isValid: true,
      hasCoverImage: false,
      isSamePhoto: true,
    });
  });
});

describe('resolvePostCoverImage — оновлення', () => {
  it('опис і підпис, яких немає в запиті, лишаються: зміна заголовка опублікованої — можна', () => {
    const requested = { translations: [{ languageCode: 'en' }] };
    expect(updatePost(COMPLETE_COVER, requested)).toEqual({
      isValid: true,
      ...SAME_PHOTO,
    });
  });

  it('та сама адреса в запиті (форма надсилає все) — фото те саме, опис лишається', () => {
    expect(updatePost(COMPLETE_COVER, { coverImageUrl: COVER_URL })).toEqual({
      isValid: true,
      ...SAME_PHOTO,
    });
  });

  it('інше фото без опису й підпису — COVER_IMAGE_ALT_REQUIRED: старі не переносяться', () => {
    expect(
      updatePost(COMPLETE_COVER, { coverImageUrl: OTHER_COVER_URL }),
    ).toEqual({ isValid: false, errorCode: 'COVER_IMAGE_ALT_REQUIRED' });
  });

  it('інше фото з описом кожною мовою, але без підпису — COVER_IMAGE_CREDIT_REQUIRED', () => {
    const requested = {
      ...COMPLETE_COVER,
      coverImageUrl: OTHER_COVER_URL,
      coverImageCredit: undefined,
    };
    expect(updatePost(COMPLETE_COVER, requested)).toEqual({
      isValid: false,
      errorCode: 'COVER_IMAGE_CREDIT_REQUIRED',
    });
  });

  it('інше фото з новими описом і підписом — можна', () => {
    const requested = { ...COMPLETE_COVER, coverImageUrl: OTHER_COVER_URL };
    expect(updatePost(COMPLETE_COVER, requested)).toEqual({
      isValid: true,
      ...NEW_PHOTO,
    });
  });

  it('опис прибрано (null) в опублікованої з обкладинкою — COVER_IMAGE_ALT_REQUIRED', () => {
    const requested = {
      translations: [{ languageCode: 'uk', coverImageAlt: null }],
    };
    expect(updatePost(COMPLETE_COVER, requested)).toEqual({
      isValid: false,
      errorCode: 'COVER_IMAGE_ALT_REQUIRED',
    });
  });

  it('новий переклад без опису — COVER_IMAGE_ALT_REQUIRED', () => {
    const englishOnly: PostCoverImageState = {
      ...COMPLETE_COVER,
      translations: [{ languageCode: 'en', coverImageAlt: ALT_EN }],
    };
    const requested = { translations: [{ languageCode: 'uk' }] };
    expect(updatePost(englishOnly, requested)).toEqual({
      isValid: false,
      errorCode: 'COVER_IMAGE_ALT_REQUIRED',
    });
  });

  it('публікація чернетки: переклад поза запитом без опису — COVER_IMAGE_ALT_REQUIRED', () => {
    const incompleteDraft: PostCoverImageState = {
      ...COMPLETE_COVER,
      translations: [
        { languageCode: 'en', coverImageAlt: ALT_EN },
        { languageCode: 'uk', coverImageAlt: null },
      ],
    };
    expect(updatePost(incompleteDraft, {})).toEqual({
      isValid: false,
      errorCode: 'COVER_IMAGE_ALT_REQUIRED',
    });
  });

  it('переклад вимкненою мовою без опису публікації не заважає: сайт його не показує, а задати опис не можна', () => {
    const withDisabledLanguage: PostCoverImageState = {
      ...COMPLETE_COVER,
      translations: [
        ...COMPLETE_COVER.translations,
        { languageCode: 'es', coverImageAlt: null },
      ],
    };
    expect(updatePost(withDisabledLanguage, {})).toEqual({
      isValid: true,
      ...SAME_PHOTO,
    });
  });

  it('публікація чернетки без підпису — COVER_IMAGE_CREDIT_REQUIRED; з підписом у запиті — можна', () => {
    const draftWithoutCredit = { ...COMPLETE_COVER, coverImageCredit: null };
    expect(updatePost(draftWithoutCredit, {})).toEqual({
      isValid: false,
      errorCode: 'COVER_IMAGE_CREDIT_REQUIRED',
    });
    expect(
      updatePost(draftWithoutCredit, { coverImageCredit: CREDIT }),
    ).toEqual({ isValid: true, ...SAME_PHOTO });
  });

  it('обкладинку додано до опублікованої без опису — COVER_IMAGE_ALT_REQUIRED', () => {
    const withoutCover: PostCoverImageState = {
      coverImageUrl: null,
      coverImageCredit: null,
      translations: [
        { languageCode: 'en', coverImageAlt: null },
        { languageCode: 'uk', coverImageAlt: null },
      ],
    };
    expect(
      updatePost(withoutCover, {
        coverImageUrl: COVER_URL,
        coverImageCredit: CREDIT,
      }),
    ).toEqual({ isValid: false, errorCode: 'COVER_IMAGE_ALT_REQUIRED' });
  });

  it('обкладинку прибрано (null) — можна навіть без опису в запиті', () => {
    const requested = {
      coverImageUrl: null,
      translations: [{ languageCode: 'uk', coverImageAlt: null }],
    };
    expect(updatePost(COMPLETE_COVER, requested)).toEqual({
      isValid: true,
      hasCoverImage: false,
      isSamePhoto: false,
    });
  });

  it('знята з публікації (ARCHIVED) може лишитись неповною', () => {
    const requested = { coverImageCredit: null };
    expect(updatePost(COMPLETE_COVER, requested, PostStatus.ARCHIVED)).toEqual({
      isValid: true,
      ...SAME_PHOTO,
    });
  });
});

describe('resolvePostCoverImage — фотобанк обкладинки (M1.8.3a)', () => {
  it.each([PostStatus.DRAFT, PostStatus.PUBLISHED])(
    'нова новина (%s) з фото не з фотобанку — COVER_IMAGE_HOST_NOT_ALLOWED',
    (status) => {
      const requested = { ...COMPLETE_COVER, coverImageUrl: FOREIGN_COVER_URL };
      expect(createPost(requested, status)).toEqual({
        isValid: false,
        errorCode: 'COVER_IMAGE_HOST_NOT_ALLOWED',
      });
    },
  );

  describe('збережене фото з іншого хоста', () => {
    const foreignCover = {
      ...COMPLETE_COVER,
      coverImageUrl: FOREIGN_COVER_URL,
    };

    it.each([
      ['адресу не передано — правка тексту', {}],
      ['передано ту саму адресу', { coverImageUrl: FOREIGN_COVER_URL }],
      ['змінено лише підпис', { coverImageCredit: 'Getty Images' }],
    ])('%s — можна: фото лишається', (_case, requested) => {
      expect(updatePost(foreignCover, requested)).toEqual({
        isValid: true,
        ...SAME_PHOTO,
      });
    });

    it('інша адреса не з фотобанку — COVER_IMAGE_HOST_NOT_ALLOWED, і в чернетці', () => {
      expect(
        updatePost(
          foreignCover,
          { coverImageUrl: 'https://news.example/photos/stadium.jpg' },
          PostStatus.DRAFT,
        ),
      ).toEqual({ isValid: false, errorCode: 'COVER_IMAGE_HOST_NOT_ALLOWED' });
    });

    it('заміна фотом з фотобанку чи прибрати обкладинку — можна', () => {
      expect(updatePost(foreignCover, COMPLETE_COVER)).toEqual({
        isValid: true,
        ...NEW_PHOTO,
      });
      expect(updatePost(foreignCover, { coverImageUrl: null })).toEqual({
        isValid: true,
        hasCoverImage: false,
        isSamePhoto: false,
      });
    });
  });
});

describe('coverImageTextToStore — що записати в опис чи підпис', () => {
  it.each([
    ['те саме фото, передано — передане', SAME_PHOTO, ALT_EN, ALT_EN],
    ['те саме фото, не передано — не чіпати', SAME_PHOTO, undefined, undefined],
    ['нове фото, передано — передане', NEW_PHOTO, ALT_EN, ALT_EN],
    [
      'нове фото, не передано — очистити опис старого',
      NEW_PHOTO,
      undefined,
      null,
    ],
    [
      'фото прибрали — очистити, навіть передане',
      { hasCoverImage: false, isSamePhoto: false },
      ALT_EN,
      null,
    ],
    [
      'фото не було й немає — не писати нічого',
      { hasCoverImage: false, isSamePhoto: true },
      ALT_EN,
      undefined,
    ],
  ] as const)('%s', (_case, photo, requestedValue, storedValue) => {
    expect(coverImageTextToStore(requestedValue, photo)).toBe(storedValue);
  });
});
