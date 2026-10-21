import {
  resolvePostSource,
  type PostSourceRequest,
  type PostSourceState,
  type PostSourceWrite,
} from './post-source';

const SOURCE_URL = 'https://www.bbc.com/sport/football/articles/derby';
const SOURCE_NAME = 'BBC Sport';
const OTHER_SOURCE_URL = 'https://www.nytimes.com/athletic/football/derby';
const OTHER_SOURCE_NAME = 'The Athletic';

const NAMED_SOURCE: PostSourceState = {
  sourceUrl: SOURCE_URL,
  sourceName: SOURCE_NAME,
};
const UNNAMED_SOURCE: PostSourceState = {
  sourceUrl: SOURCE_URL,
  sourceName: null,
};
const NO_SOURCE: PostSourceState = { sourceUrl: null, sourceName: null };

describe('resolvePostSource — нова новина', () => {
  it.each<[string, PostSourceRequest, PostSourceWrite]>([
    [
      'адреса й назва — записати обидві',
      { sourceUrl: SOURCE_URL, sourceName: SOURCE_NAME },
      { sourceUrl: SOURCE_URL, sourceName: SOURCE_NAME },
    ],
    [
      'лише адреса — без назви, сайт покаже домен',
      { sourceUrl: SOURCE_URL },
      { sourceUrl: SOURCE_URL, sourceName: null },
    ],
    [
      'без джерела — своя новина, нічого не писати',
      {},
      { sourceUrl: undefined, sourceName: undefined },
    ],
  ])('%s', (_case, requested, source) => {
    expect(resolvePostSource({ current: null, requested })).toEqual({
      isValid: true,
      source,
    });
  });

  it('назва без адреси — SOURCE_URL_REQUIRED', () => {
    expect(
      resolvePostSource({
        current: null,
        requested: { sourceName: SOURCE_NAME },
      }),
    ).toEqual({ isValid: false, errorCode: 'SOURCE_URL_REQUIRED' });
  });
});

describe('resolvePostSource — оновлення', () => {
  it.each<[string, PostSourceState, PostSourceRequest, PostSourceWrite]>([
    [
      'запит без полів джерела — не чіпати',
      NAMED_SOURCE,
      {},
      { sourceUrl: undefined, sourceName: undefined },
    ],
    [
      'та сама адреса в запиті (форма надсилає все) — назва лишається',
      NAMED_SOURCE,
      { sourceUrl: SOURCE_URL },
      { sourceUrl: SOURCE_URL, sourceName: undefined },
    ],
    [
      'назва для наявної адреси',
      UNNAMED_SOURCE,
      { sourceName: SOURCE_NAME },
      { sourceUrl: undefined, sourceName: SOURCE_NAME },
    ],
    [
      'інша адреса без назви — стара назва не переноситься: це може бути інше видання',
      NAMED_SOURCE,
      { sourceUrl: OTHER_SOURCE_URL },
      { sourceUrl: OTHER_SOURCE_URL, sourceName: null },
    ],
    [
      'інша адреса з новою назвою',
      NAMED_SOURCE,
      { sourceUrl: OTHER_SOURCE_URL, sourceName: OTHER_SOURCE_NAME },
      { sourceUrl: OTHER_SOURCE_URL, sourceName: OTHER_SOURCE_NAME },
    ],
    [
      'адресу прибрано — назва прибирається разом з нею',
      NAMED_SOURCE,
      { sourceUrl: null },
      { sourceUrl: null, sourceName: null },
    ],
    [
      'прибрано лише назву — адреса лишається, сайт покаже домен',
      NAMED_SOURCE,
      { sourceName: null },
      { sourceUrl: undefined, sourceName: null },
    ],
  ])('%s', (_case, current, requested, source) => {
    expect(resolvePostSource({ current, requested })).toEqual({
      isValid: true,
      source,
    });
  });

  it.each<[string, PostSourceState, PostSourceRequest]>([
    ['назва в новини без джерела', NO_SOURCE, { sourceName: SOURCE_NAME }],
    [
      'адресу прибрано, а назву передано',
      NAMED_SOURCE,
      { sourceUrl: null, sourceName: SOURCE_NAME },
    ],
  ])('%s — SOURCE_URL_REQUIRED', (_case, current, requested) => {
    expect(resolvePostSource({ current, requested })).toEqual({
      isValid: false,
      errorCode: 'SOURCE_URL_REQUIRED',
    });
  });
});
