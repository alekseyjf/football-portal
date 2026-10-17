import type { LanguageRepository, LanguageRow } from './language.repository';
import { LanguageService } from './language.service';

const LANGUAGES: LanguageRow[] = [
  { code: 'en', isDefault: true, isActive: true },
  { code: 'uk', isDefault: false, isActive: true },
  { code: 'de', isDefault: false, isActive: false },
];

function createService(languages: LanguageRow[] = LANGUAGES) {
  const findAll = jest.fn(() => Promise.resolve(languages));
  const service = new LanguageService({
    findAll,
  } as unknown as LanguageRepository);
  return { service, findAll };
}

describe('LanguageService.chooseContentLanguage', () => {
  it.each([
    ['uk', 'uk'],
    ['en', 'en'],
    [' UK ', 'uk'],
    ['ua', 'en'], // код країни, не мови (D22)
    ['xx', 'en'],
    ['de', 'en'], // неактивна
    ['', 'en'],
    [undefined, 'en'],
    [['uk', 'en'], 'en'], // ?lang=uk&lang=en
    [{ code: 'uk' }, 'en'],
  ])('lang=%j → %s', async (requestedLang, requestedCode) => {
    const { service } = createService();
    await expect(service.chooseContentLanguage(requestedLang)).resolves.toEqual(
      { requestedCode, defaultCode: 'en' },
    );
  });
});

describe('LanguageService.getContentLanguages', () => {
  afterEach(() => jest.useRealTimers());

  it('активні мови + default', async () => {
    const { service } = createService();
    const languages = await service.getContentLanguages();
    expect(languages.defaultCode).toBe('en');
    expect([...languages.activeCodes].sort()).toEqual(['en', 'uk']);
  });

  it('default-мова доступна, навіть якщо її вимкнули', async () => {
    const { service } = createService([
      { code: 'en', isDefault: true, isActive: false },
      { code: 'uk', isDefault: false, isActive: true },
    ]);
    const languages = await service.getContentLanguages();
    expect(languages.activeCodes.has('en')).toBe(true);
  });

  it('без default-мови — помилка', async () => {
    const { service } = createService([
      { code: 'uk', isDefault: false, isActive: true },
    ]);
    await expect(service.getContentLanguages()).rejects.toThrow(
      /No default Language/,
    );
  });

  it('кеш 60 с: повторні виклики не читають БД, після TTL — читають', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-09-26T12:00:00Z') });
    const { service, findAll } = createService();
    await service.getContentLanguages();
    await service.chooseContentLanguage('uk');
    jest.advanceTimersByTime(59_000);
    await service.getContentLanguages();
    expect(findAll).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2_000);
    await service.getContentLanguages();
    expect(findAll).toHaveBeenCalledTimes(2);
  });

  it('паралельні запити без кешу — одне читання БД', async () => {
    const { service, findAll } = createService();
    await Promise.all(
      Array.from({ length: 10 }, () => service.getContentLanguages()),
    );
    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('збій читання не кешується', async () => {
    const findAll = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(LANGUAGES);
    const service = new LanguageService({
      findAll,
    } as unknown as LanguageRepository);
    await expect(service.getContentLanguages()).rejects.toThrow('db down');
    await expect(service.getContentLanguages()).resolves.toMatchObject({
      defaultCode: 'en',
    });
  });
});
