import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostEventPublisher } from './post-event-publisher';
import { ScheduledPostRepository } from './scheduled-post.repository';

/** Новин за один запис: після простою воркер наздоганяє все порціями, не тримаючи тисячі блокувань разом. */
export const SCHEDULED_POST_BATCH_SIZE = 100;

/**
 * Публікація за розкладом (D57): раз на хвилину запланована, чия дата настала, стає PUBLISHED — і шле ту саму
 * подію `post.published`, що й ручна публікація. Пошук за станом, а не за вікном часу: пропущені проходи (рестарт,
 * простій) наступний наздожене сам. Кілька інстансів одне одному не заважають — `SKIP LOCKED`.
 */
@Injectable()
export class ScheduledPostPublisher {
  private readonly log = new Logger(ScheduledPostPublisher.name);

  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly postEventPublisher: PostEventPublisher,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishDueNow(): Promise<void> {
    try {
      await this.publishDue(new Date());
    } catch (error) {
      this.log.warn(
        `Публікація за розкладом: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Публікує всі заплановані з датою ≤ `now` порціями, поки порція повна; повертає, скільки опубліковано. */
  async publishDue(now: Date): Promise<number> {
    let publishedCount = 0;
    let batchSize: number;
    do {
      const publishedPosts = await this.scheduledPostRepository.publishDueBatch(
        now,
        SCHEDULED_POST_BATCH_SIZE,
      );
      // Порцію вже закомічено: підписник бачить новину опублікованою
      this.postEventPublisher.publishPublished(publishedPosts);
      publishedCount += publishedPosts.length;
      batchSize = publishedPosts.length;
    } while (batchSize === SCHEDULED_POST_BATCH_SIZE);
    return publishedCount;
  }
}
