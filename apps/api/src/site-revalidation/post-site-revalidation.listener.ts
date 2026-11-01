import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  POST_PUBLISHED_EVENT,
  POST_UNPUBLISHED_EVENT,
  POST_UPDATED_EVENT,
  type PostEventName,
  type PostRef,
} from '../posts/post-events';
import {
  SITE_REVALIDATOR,
  type SiteRevalidator,
} from './site-revalidator.port';

/**
 * Підписник подій новини (D57): сповіщає сайт, щоб кеш сторінок, sitemap і Google News sitemap оновились одразу,
 * а не за TTL. `async: true` — EventEmitter2 кличе підписника в наступному такті, тож ні збереження в адмінці, ні
 * прохід воркера вебхука не чекають; збій — лише в лог: запис уже відбувся, а TTL сайту — страховка. Подія живе
 * в пам'яті процесу — рестарт між записом і вебхуком її губить; повторів немає (outbox і повтори — backlog).
 */
@Injectable()
export class PostSiteRevalidationListener {
  private readonly log = new Logger(PostSiteRevalidationListener.name);

  constructor(
    @Inject(SITE_REVALIDATOR) private readonly siteRevalidator: SiteRevalidator,
  ) {}

  @OnEvent(POST_PUBLISHED_EVENT, { async: true })
  onPostPublished(post: PostRef): Promise<void> {
    return this.notifySite(POST_PUBLISHED_EVENT, post);
  }

  @OnEvent(POST_UPDATED_EVENT, { async: true })
  onPostUpdated(post: PostRef): Promise<void> {
    return this.notifySite(POST_UPDATED_EVENT, post);
  }

  @OnEvent(POST_UNPUBLISHED_EVENT, { async: true })
  onPostUnpublished(post: PostRef): Promise<void> {
    return this.notifySite(POST_UNPUBLISHED_EVENT, post);
  }

  private async notifySite(name: PostEventName, post: PostRef): Promise<void> {
    try {
      await this.siteRevalidator.postChanged({ name, post });
    } catch (error) {
      // Без секрету й адреси: лише подія, номер і причина
      this.log.warn(
        `Сайт не отримав ${name} новини ${post.number}: ${describeError(error)} — кеш сайту оновить TTL`,
      );
    }
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // fetch: «fetch failed» — причина (ECONNREFUSED, DNS) у `cause`
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${error.name} ${error.message}${cause}`;
}
