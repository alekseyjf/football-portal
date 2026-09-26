import { Injectable } from '@nestjs/common';
import { LanguageRepository } from './language.repository';

/** Мови змінюються рідко (`INSERT` у `Language`, D8) — читаємо БД не частіше, ніж раз на хвилину. */
const LANGUAGE_CACHE_TTL_MS = 60 * 1000;

export interface ContentLanguages {
  defaultCode: string;
  activeCodes: ReadonlySet<string>;
}

/** Мова, якою читаємо контент: запитана (якщо активна) і default для fallback (розділ 8). */
export interface ContentLanguageChoice {
  requestedCode: string;
  defaultCode: string;
}

@Injectable()
export class LanguageService {
  private cachedLanguages: ContentLanguages | null = null;
  private cachedAt = 0;
  private pendingLoad: Promise<ContentLanguages> | null = null;

  constructor(private readonly languageRepository: LanguageRepository) {}

  async getContentLanguages(): Promise<ContentLanguages> {
    if (
      this.cachedLanguages &&
      Date.now() - this.cachedAt < LANGUAGE_CACHE_TTL_MS
    ) {
      return this.cachedLanguages;
    }
    // Паралельні запити після закінчення TTL чекають одне читання БД
    this.pendingLoad ??= this.loadLanguages().finally(() => {
      this.pendingLoad = null;
    });
    return this.pendingLoad;
  }

  /**
   * `?lang=` з запиту: невідома, неактивна або не рядок (`?lang=a&lang=b`) → default, без 400
   * (розділ 8, P3-3).
   */
  async chooseContentLanguage(
    requestedLang: unknown,
  ): Promise<ContentLanguageChoice> {
    const { defaultCode, activeCodes } = await this.getContentLanguages();
    const normalizedLang =
      typeof requestedLang === 'string'
        ? requestedLang.trim().toLowerCase()
        : '';
    return {
      requestedCode: activeCodes.has(normalizedLang)
        ? normalizedLang
        : defaultCode,
      defaultCode,
    };
  }

  private async loadLanguages(): Promise<ContentLanguages> {
    const languages = await this.languageRepository.findAll();
    const defaultLanguage = languages.find((language) => language.isDefault);
    if (!defaultLanguage) {
      // Seed створює `en` з isDefault; без неї fallback контенту неможливий
      throw new Error('No default Language in the database (run pnpm db:seed)');
    }
    const activeCodes = new Set(
      languages
        .filter((language) => language.isActive)
        .map((language) => language.code),
    );
    // Default-мова завжди доступна для читання, навіть якщо її помилково вимкнули
    activeCodes.add(defaultLanguage.code);

    this.cachedLanguages = { defaultCode: defaultLanguage.code, activeCodes };
    this.cachedAt = Date.now();
    return this.cachedLanguages;
  }
}
