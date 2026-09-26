import { PostStatus } from '@prisma/client';
import {
  resolvePostPublication,
  type PostPublication,
  type PostPublicationInput,
} from './post-publication';

const NOW = new Date('2026-09-26T12:00:00.000Z');
const PAST = new Date('2026-09-20T08:00:00.000Z');
const FUTURE = new Date('2026-10-01T10:00:00.000Z');

function resolve(input: Omit<PostPublicationInput, 'now'>) {
  return resolvePostPublication({ ...input, now: NOW });
}

function expectPublication(
  input: Omit<PostPublicationInput, 'now'>,
  publication: PostPublication,
) {
  expect(resolve(input)).toEqual({ isValid: true, publication });
}

function expectError(
  input: Omit<PostPublicationInput, 'now'>,
  errorCode: string,
) {
  expect(resolve(input)).toEqual({ isValid: false, errorCode });
}

const draft: PostPublication = { status: PostStatus.DRAFT, publishedAt: null };
const published: PostPublication = {
  status: PostStatus.PUBLISHED,
  publishedAt: PAST,
};
const scheduled: PostPublication = {
  status: PostStatus.SCHEDULED,
  publishedAt: FUTURE,
};
/** Запланований, дата якого вже настала (видно на сайті, статус у БД — SCHEDULED) */
const scheduledLive: PostPublication = {
  status: PostStatus.SCHEDULED,
  publishedAt: PAST,
};
const archived: PostPublication = {
  status: PostStatus.ARCHIVED,
  publishedAt: PAST,
};

describe('resolvePostPublication — створення', () => {
  it('без статусу — чернетка без дати', () => {
    expectPublication({ current: null }, draft);
  });

  it('DRAFT з датою — 400', () => {
    expectError(
      {
        current: null,
        requestedStatus: PostStatus.DRAFT,
        requestedPublishedAt: FUTURE,
      },
      'PUBLISHED_AT_NOT_ALLOWED',
    );
  });

  it('PUBLISHED без дати — now', () => {
    expectPublication(
      { current: null, requestedStatus: PostStatus.PUBLISHED },
      { status: PostStatus.PUBLISHED, publishedAt: NOW },
    );
  });

  it('PUBLISHED з минулою датою — backdating дозволено', () => {
    expectPublication(
      {
        current: null,
        requestedStatus: PostStatus.PUBLISHED,
        requestedPublishedAt: PAST,
      },
      published,
    );
  });

  it('PUBLISHED з датою рівно now — дозволено', () => {
    expectPublication(
      {
        current: null,
        requestedStatus: PostStatus.PUBLISHED,
        requestedPublishedAt: NOW,
      },
      { status: PostStatus.PUBLISHED, publishedAt: NOW },
    );
  });

  it('PUBLISHED з майбутньою датою — 400 (це SCHEDULED)', () => {
    expectError(
      {
        current: null,
        requestedStatus: PostStatus.PUBLISHED,
        requestedPublishedAt: FUTURE,
      },
      'PUBLISHED_AT_IN_FUTURE',
    );
  });

  it('SCHEDULED з майбутньою датою', () => {
    expectPublication(
      {
        current: null,
        requestedStatus: PostStatus.SCHEDULED,
        requestedPublishedAt: FUTURE,
      },
      scheduled,
    );
  });

  it('SCHEDULED без дати — 400', () => {
    expectError(
      { current: null, requestedStatus: PostStatus.SCHEDULED },
      'PUBLISHED_AT_REQUIRED',
    );
  });

  it('SCHEDULED з минулою датою або рівно now — 400', () => {
    for (const requestedPublishedAt of [PAST, NOW]) {
      expectError(
        {
          current: null,
          requestedStatus: PostStatus.SCHEDULED,
          requestedPublishedAt,
        },
        'SCHEDULED_AT_IN_PAST',
      );
    }
  });

  it('ARCHIVED при створенні — 400', () => {
    expectError(
      { current: null, requestedStatus: PostStatus.ARCHIVED },
      'POST_STATUS_NOT_ALLOWED',
    );
  });

  it('дата без статусу — валідується як для чернетки', () => {
    expectError(
      { current: null, requestedPublishedAt: FUTURE },
      'PUBLISHED_AT_NOT_ALLOWED',
    );
  });
});

describe('resolvePostPublication — оновлення', () => {
  it('без статусу і дати — нічого не змінюється (у т.ч. запланований, що вже вийшов)', () => {
    for (const current of [
      draft,
      published,
      scheduled,
      scheduledLive,
      archived,
    ]) {
      expectPublication({ current }, current);
    }
  });

  it('той самий статус без дати — нічого не змінюється', () => {
    expectPublication(
      { current: scheduledLive, requestedStatus: PostStatus.SCHEDULED },
      scheduledLive,
    );
  });

  it('DRAFT → PUBLISHED — now', () => {
    expectPublication(
      { current: draft, requestedStatus: PostStatus.PUBLISHED },
      { status: PostStatus.PUBLISHED, publishedAt: NOW },
    );
  });

  it('SCHEDULED (ще не настав) → PUBLISHED — «опублікувати зараз»', () => {
    expectPublication(
      { current: scheduled, requestedStatus: PostStatus.PUBLISHED },
      { status: PostStatus.PUBLISHED, publishedAt: NOW },
    );
  });

  it('SCHEDULED, що вже вийшов → PUBLISHED — дата зберігається', () => {
    expectPublication(
      { current: scheduledLive, requestedStatus: PostStatus.PUBLISHED },
      published,
    );
  });

  it('ARCHIVED → PUBLISHED — повертається з початковою датою', () => {
    expectPublication(
      { current: archived, requestedStatus: PostStatus.PUBLISHED },
      published,
    );
  });

  it('архівована чернетка (без дати) → PUBLISHED — now', () => {
    expectPublication(
      {
        current: { status: PostStatus.ARCHIVED, publishedAt: null },
        requestedStatus: PostStatus.PUBLISHED,
      },
      { status: PostStatus.PUBLISHED, publishedAt: NOW },
    );
  });

  it('PUBLISHED → DRAFT — дата скидається', () => {
    expectPublication(
      { current: published, requestedStatus: PostStatus.DRAFT },
      draft,
    );
  });

  it('PUBLISHED → ARCHIVED — дата зберігається', () => {
    expectPublication(
      { current: published, requestedStatus: PostStatus.ARCHIVED },
      archived,
    );
  });

  it('ARCHIVED з датою — 400', () => {
    expectError(
      {
        current: published,
        requestedStatus: PostStatus.ARCHIVED,
        requestedPublishedAt: PAST,
      },
      'PUBLISHED_AT_NOT_ALLOWED',
    );
  });

  it('перенос запланованого лише датою (без статусу)', () => {
    const later = new Date('2026-10-05T09:00:00.000Z');
    expectPublication(
      { current: scheduled, requestedPublishedAt: later },
      { status: PostStatus.SCHEDULED, publishedAt: later },
    );
  });

  it('перенос запланованого в минуле — 400', () => {
    expectError(
      { current: scheduled, requestedPublishedAt: PAST },
      'SCHEDULED_AT_IN_PAST',
    );
  });

  it('PUBLISHED → SCHEDULED без дати — 400 (минула дата публікації не переноситься)', () => {
    expectError(
      { current: published, requestedStatus: PostStatus.SCHEDULED },
      'PUBLISHED_AT_REQUIRED',
    );
  });

  it('PUBLISHED → SCHEDULED з майбутньою датою — зняти з сайту до дати', () => {
    expectPublication(
      {
        current: published,
        requestedStatus: PostStatus.SCHEDULED,
        requestedPublishedAt: FUTURE,
      },
      scheduled,
    );
  });

  it('зміна дати опублікованого — лише в минуле', () => {
    expectPublication(
      { current: published, requestedPublishedAt: NOW },
      { status: PostStatus.PUBLISHED, publishedAt: NOW },
    );
    expectError(
      { current: published, requestedPublishedAt: FUTURE },
      'PUBLISHED_AT_IN_FUTURE',
    );
  });

  it('дата для чернетки без зміни статусу — 400', () => {
    expectError(
      { current: draft, requestedPublishedAt: FUTURE },
      'PUBLISHED_AT_NOT_ALLOWED',
    );
  });
});
