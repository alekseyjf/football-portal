import { Injectable } from '@nestjs/common';
import {
  LanguageService,
  type ContentLanguages,
} from '../languages/language.service';
import type {
  NewsSitemapDto,
  PostSitemapDto,
  PostSitemapIndexDto,
} from './dto/post-sitemap-response.dto';
import {
  NEWS_SITEMAP_URL_LIMIT,
  NEWS_SITEMAP_WINDOW_MS,
  SITEMAP_URL_LIMIT,
  sitemapMonthRange,
  sitemapPostLimit,
} from './post-sitemap';
import { toNewsSitemapEntry, toSitemapEntry } from './post-response';
import {
  PostSitemapRepository,
  type SitemapPostsQuery,
} from './post-sitemap.repository';

/** Новини для sitemap сайту (D57): місяці, новини місяця, Google News за 48 год. */
@Injectable()
export class PostSitemapService {
  constructor(
    private readonly postSitemapRepository: PostSitemapRepository,
    private readonly languageService: LanguageService,
  ) {}

  async getSitemapIndex(): Promise<PostSitemapIndexDto> {
    const languages = await this.languageService.getContentLanguages();
    const months = await this.postSitemapRepository.findMonths(
      { now: new Date(), defaultLanguageCode: languages.defaultCode },
      [...languages.activeCodes],
    );
    return { months };
  }

  async getMonthSitemap(month: string): Promise<PostSitemapDto> {
    const languages = await this.languageService.getContentLanguages();
    const { start, end } = sitemapMonthRange(month);
    const postRows = await this.postSitemapRepository.findPosts({
      ...sitemapQueryBase(languages, new Date(), SITEMAP_URL_LIMIT),
      publishedFrom: start,
      publishedBefore: end,
    });
    return { posts: postRows.map(toSitemapEntry) };
  }

  async getNewsSitemap(): Promise<NewsSitemapDto> {
    const languages = await this.languageService.getContentLanguages();
    const now = new Date();
    const postRows = await this.postSitemapRepository.findNewsPosts({
      ...sitemapQueryBase(languages, now, NEWS_SITEMAP_URL_LIMIT),
      publishedFrom: new Date(now.getTime() - NEWS_SITEMAP_WINDOW_MS),
    });
    return { posts: postRows.map(toNewsSitemapEntry) };
  }
}

function sitemapQueryBase(
  languages: ContentLanguages,
  now: Date,
  urlLimit: number,
): Omit<SitemapPostsQuery, 'publishedFrom' | 'publishedBefore'> {
  return {
    scope: { now, defaultLanguageCode: languages.defaultCode },
    languageCodes: [...languages.activeCodes],
    take: sitemapPostLimit(urlLimit, languages.activeCodes.size),
  };
}
