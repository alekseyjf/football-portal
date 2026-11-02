import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  HOME_UPDATED_EVENT,
  POST_PUBLISHED_EVENT,
  type PostEvent,
  type PostRef,
} from './post-events';

/**
 * Шле події новини (D57) — лише після коміту запису. Підписники асинхронні (`@OnEvent(…, { async: true })`):
 * запит редактора чи прохід воркера на них не чекає, а їхній збій публікацію не ламає.
 */
@Injectable()
export class PostEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish(events: readonly PostEvent[]): void {
    for (const event of events) this.eventEmitter.emit(event.name, event.post);
  }

  /** Воркер розкладу: кожна новина порції стала PUBLISHED. */
  publishPublished(posts: readonly PostRef[]): void {
    this.publish(posts.map((post) => ({ name: POST_PUBLISHED_EVENT, post })));
  }

  /** Редактор закріпив головну новину чи зняв закріплення (D56). */
  publishHomeUpdated(): void {
    this.eventEmitter.emit(HOME_UPDATED_EVENT);
  }
}
