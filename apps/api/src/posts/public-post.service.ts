import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LanguageService,
  type ContentLanguageChoice,
} from '../languages/language.service';
import { languageCodesToLoad } from '../languages/translation-fallback';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import type { PaginatedPostsDto, PostDetailDto } from './dto/post-response.dto';
import { toPublicPostDetail, toPublicPostSummary } from './post-response';
import type { PublicPostScope } from './post-visibility';
import { PublicPostRepository } from './public-post.repository';

function publicScope(
  languageChoice: ContentLanguageChoice,
  now: Date,
): PublicPostScope {
  return { now, defaultLanguageCode: languageChoice.defaultCode };
}

/** Новини для читачів: стрічка й новина за номером — лише живі, переклад з fallback на default-мову. */
@Injectable()
export class PublicPostService {
  constructor(
    private readonly publicPostRepository: PublicPostRepository,
    private readonly languageService: LanguageService,
  ) {}

  async getPublicPosts(query: ListPostsQueryDto): Promise<PaginatedPostsDto> {
    const languageChoice = await this.languageService.chooseContentLanguage(
      query.lang,
    );
    const { posts, total } = await this.publicPostRepository.findPublicPage({
      scope: publicScope(languageChoice, new Date()),
      filters: query,
      languageCodes: languageCodesToLoad(languageChoice),
      pagination: { skip: (query.page - 1) * query.limit, take: query.limit },
    });
    return {
      data: posts.map((postRow) =>
        toPublicPostSummary(postRow, languageChoice),
      ),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getPublicPostByNumber(
    postNumber: number,
    requestedLang: unknown,
  ): Promise<PostDetailDto> {
    const [languageChoice, { activeCodes }] = await Promise.all([
      this.languageService.chooseContentLanguage(requestedLang),
      this.languageService.getContentLanguages(),
    ]);
    const scope = publicScope(languageChoice, new Date());
    const [postRow, translationLanguages] = await Promise.all([
      this.publicPostRepository.findPublicByNumber(
        postNumber,
        scope,
        languageCodesToLoad(languageChoice),
      ),
      this.publicPostRepository.findPublicTranslationLanguages(
        postNumber,
        scope,
      ),
    ]);
    if (!postRow) throw new NotFoundException('POST_NOT_FOUND');

    return toPublicPostDetail(
      postRow,
      languageChoice,
      // Переклад вимкненою мовою не рекламуємо в hreflang
      translationLanguages.filter((languageCode) =>
        activeCodes.has(languageCode),
      ),
    );
  }
}
