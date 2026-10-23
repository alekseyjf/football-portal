import { describe, expect, it } from 'vitest';
import { publicationOptionsFor, type PublicationState } from './publicationOptions';

const CONTEXT = { now: new Date('2026-10-23T09:00:00.000Z'), timeZone: 'Europe/Kyiv' };

function optionValuesFor(post: PublicationState | null) {
  return publicationOptionsFor(post, CONTEXT).map((option) => option.value);
}

describe('publicationOptionsFor: статуси, які форма пропонує новині', () => {
  it('нова, чернетка й запланована, що чекає, — Draft / Publish now / Schedule, без Archived', () => {
    const allButArchived = ['DRAFT', 'PUBLISHED', 'SCHEDULED'];
    expect(optionValuesFor(null)).toEqual(allButArchived);
    expect(optionValuesFor({ status: 'DRAFT', isLive: false, publishedAt: null })).toEqual(allButArchived);
    expect(
      optionValuesFor({ status: 'SCHEDULED', isLive: false, publishedAt: '2026-10-26T08:00:00.000Z' }),
    ).toEqual(allButArchived);
  });

  it('на сайті — лише Published або зняти (Archived), без Draft; запланована, чий час настав, — теж на сайті', () => {
    for (const status of ['PUBLISHED', 'SCHEDULED'] as const) {
      const options = publicationOptionsFor(
        { status, isLive: true, publishedAt: '2026-10-20T07:00:00.000Z' },
        CONTEXT,
      );
      expect(options.map((option) => option.value)).toEqual(['PUBLISHED', 'ARCHIVED']);
      expect(options[0].hint).toContain('20 Oct 2026, 10:00');
    }
  });

  it('архівна — назад на сайт зі своєю датою або в чернетки; знята до свого часу вийде зараз', () => {
    const archived = publicationOptionsFor(
      { status: 'ARCHIVED', isLive: false, publishedAt: '2026-10-20T07:00:00.000Z' },
      CONTEXT,
    );
    expect(archived.map((option) => option.value)).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
    expect(archived[1].hint).toContain('20 Oct 2026, 10:00');

    const archivedBeforeItsTime = publicationOptionsFor(
      { status: 'ARCHIVED', isLive: false, publishedAt: '2026-10-30T08:00:00.000Z' },
      CONTEXT,
    );
    expect(archivedBeforeItsTime[1].hint).toBe('Visible immediately');
  });
});
