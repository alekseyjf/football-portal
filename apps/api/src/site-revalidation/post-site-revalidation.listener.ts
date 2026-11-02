import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  HOME_UPDATED_EVENT,
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
 * Підписник подій новини й головної (D57): сповіщає сайт, щоб кеш сторінок, sitemap і Google News sitemap оновились
 * одразу, а не за TTL. `async: true` — EventEmitter2 кличе підписника в наступному такті, тож ні збереження в адмінці, ні
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

  @OnEvent(HOME_UPDATED_EVENT, { async: true })
  onHomeUpdated(): Promise<void> {
    return this.sendOrLog(HOME_UPDATED_EVENT, () =>
      this.siteRevalidator.homeChanged(),
    );
  }

  private notifySite(name: PostEventName, post: PostRef): Promise<void> {
    return this.sendOrLog(`${name} новини ${post.number}`, () =>
      this.siteRevalidator.postChanged({ name, post }),
    );
  }

  /** `subject` — подія для лога: без секрету й адреси, лише що й чому не дійшло. */
  private async sendOrLog(
    subject: string,
    send: () => Promise<void>,
  ): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.log.warn(
        `Сайт не отримав ${subject}: ${describeError(error)} — кеш сайту оновить TTL`,
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
