import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PostRef } from './post-events';

/** Публікація запланованих новин воркером (D57). */
@Injectable()
export class ScheduledPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Переводить у PUBLISHED до `limit` запланованих, чия дата настала (найстаріші першими), і повертає їх. Один
   * оператор — одна транзакція: коли проміс повернувся, запис закомічено. CTE — бо `UPDATE` у Postgres не має ні
   * `LIMIT`, ні `FOR … SKIP LOCKED`; `SKIP LOCKED` — рядок, який тримає інший воркер чи редактор (`lockEditState`),
   * пропускаємо, а не чекаємо: кожну новину публікує рівно один. `FOR NO KEY UPDATE`, а не `FOR UPDATE`, — backend
   * Rule 10. Видалену заплановану не публікуємо. `updatedAt` не зсуваємо — це дата збереження тексту (D56).
   */
  publishDueBatch(now: Date, limit: number): Promise<PostRef[]> {
    return this.prisma.$queryRaw<PostRef[]>`
      WITH due AS (
        SELECT "id" FROM "Post"
        WHERE "status" = 'SCHEDULED' AND "deletedAt" IS NULL AND "publishedAt" <= ${now}
        ORDER BY "publishedAt"
        LIMIT ${limit}
        FOR NO KEY UPDATE SKIP LOCKED
      )
      UPDATE "Post" AS post SET "status" = 'PUBLISHED'
      FROM due
      WHERE post."id" = due."id"
      RETURNING post."id", post."number", post."slug"`;
  }
}
