import { Injectable } from '@nestjs/common';
import type { Prisma, PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_POST_SELECT, type AdminPostRow } from './admin-post.repository';
import type { PinTarget } from './post-pin';

/** Рядок, який закріплюють, — після блокування. */
export type LockedPinTarget = PinTarget & { id: string };

interface LockedPinTargetRow {
  id: string;
  status: PostStatus;
  publishedAt: Date | null;
  pinnedAt: Date | null;
}

/**
 * Закріплення головної новини (D56). Блокування — `FOR NO KEY UPDATE` (не `FOR UPDATE`: той конфліктує з FK-блокуванням
 * `KEY SHARE` вставок, що посилаються на пост, — лайків, тредів), порядок — спершу новина, яку закріплюють, потім
 * закріплена: вона змінюється лише під блокуванням своєї новини, тож циклу очікувань немає.
 */
@Injectable()
export class PostPinRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Блокує невидалену новину до кінця транзакції; `null` — немає або видалена (і видалена, поки чекали). */
  async lockPinTarget(
    tx: Prisma.TransactionClient,
    postId: string,
  ): Promise<LockedPinTarget | null> {
    const [row] = await tx.$queryRaw<LockedPinTargetRow[]>`
      SELECT "id", "status", "publishedAt", "pinnedAt" FROM "Post"
      WHERE "id" = ${postId} AND "deletedAt" IS NULL
      FOR NO KEY UPDATE`;
    return row ?? null;
  }

  /**
   * Блокує закріплену зараз; `null` — жодної. Чекали на її блокування, а її тим часом відкріпили — рядок випадає
   * з результату (перевірка `WHERE` після очікування), і сервіс побачить, що закріплена змінилась.
   */
  async lockPinnedPostId(tx: Prisma.TransactionClient): Promise<string | null> {
    const [row] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Post"
      WHERE "pinnedAt" IS NOT NULL
      FOR NO KEY UPDATE`;
    return row?.id ?? null;
  }

  // Записи закріплення — сирим SQL: `@updatedAt` Prisma зсунув би `updatedAt`, а це дата збереження тексту («Saved …»
  // у формі адмінки), закріплення її не змінює

  async pin(
    tx: Prisma.TransactionClient,
    pin: { postId: string; pinnedById: string; pinnedAt: Date },
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Post" SET "pinnedAt" = ${pin.pinnedAt}, "pinnedById" = ${pin.pinnedById}
      WHERE "id" = ${pin.postId}`;
  }

  async unpinInTransaction(
    tx: Prisma.TransactionClient,
    postId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Post" SET "pinnedAt" = NULL, "pinnedById" = NULL
      WHERE "id" = ${postId}`;
  }

  findAdminRow(
    client: Prisma.TransactionClient,
    postId: string,
  ): Promise<AdminPostRow | null> {
    return client.post.findUnique({
      where: { id: postId },
      select: ADMIN_POST_SELECT,
    });
  }

  /** Зняти закріплення невидаленої новини (не закріплена — без змін) і віддати її рядок; `null` — немає чи видалена. */
  unpin(postId: string): Promise<AdminPostRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.$executeRaw`
        UPDATE "Post" SET "pinnedAt" = NULL, "pinnedById" = NULL
        WHERE "id" = ${postId} AND "deletedAt" IS NULL`;
      return updatedCount === 1 ? this.findAdminRow(tx, postId) : null;
    });
  }

  findPinnedAdminRow(): Promise<AdminPostRow | null> {
    return this.prisma.post.findFirst({
      where: { pinnedAt: { not: null } },
      select: ADMIN_POST_SELECT,
    });
  }
}
