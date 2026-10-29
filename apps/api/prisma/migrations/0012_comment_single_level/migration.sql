-- M1.7.2 (D27): коментарі як на YouTube — один рівень. Відповідь на відповідь пишеться в корінь гілки, а кому
-- відповіли — у двох nullable-колонках. SET NULL: purge коментаря (D20) чи фізичне видалення рядка `User` (акаунт
-- анонімізується, а не видаляється, D19) не валить відповіді, що на них посилались.
-- Даних не перетворює: тестові коментарі dev-БД видалив разовий SQL до міграції — глибокий рядок, якщо лишився,
-- зупинить міграцію на CHECK, а не зіпсується.
-- Відкат (ідемпотентний: `migrate deploy` міграцію в транзакцію не загортає — v5-foundation.md, розділ 11) —
-- індекси → CHECK → FK → колонки, кожне з `IF EXISTS`, і старі індекси — з `IF NOT EXISTS`.

-- Корені й відповіді тепер читаються порціями за (createdAt, id) — старі індекси замінюють нові (нижче; замір
-- `EXPLAIN` на 657 тис. рядків: перша порція 50 тис. коренів — 0,2 мс, зі старим індексом — 64 мс)
-- DropIndex
DROP INDEX "Comment_threadId_parentId_createdAt_idx";

-- DropIndex
DROP INDEX "Comment_rootId_createdAt_idx";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "replyToCommentId" TEXT,
ADD COLUMN     "replyToUserId" TEXT;

-- CreateIndex
CREATE INDEX "Comment_rootId_createdAt_id_idx" ON "Comment"("rootId", "createdAt", "id");

-- FK, на які посилаються рядки, що їх фізично видаляє purge: без індексу кожен видалений рядок перевіряє всю таблицю
-- (замір на 657 тис. рядків: 20 відповідей — 3,3 с, з індексами 5 000 — 0,34 с)
-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Comment_replyToCommentId_idx" ON "Comment"("replyToCommentId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_replyToCommentId_fkey" FOREIGN KEY ("replyToCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_replyToUserId_fkey" FOREIGN KEY ("replyToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Дубль prisma/sql/constraints.sql (як 0009, 0011): Prisma CHECK і часткових індексів не знає, при squash (розділ 11)
-- вони потрапляють у baseline звідти.
-- Корінь — без батька, кореня й адресата, глибина 0; відповідь — під коренем гілки (`parentId = rootId`), глибина 1.
-- `IS NOT NULL` — бо CHECK з NULL-результатом (`NULL = …`) проходить
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_single_level_check"
  CHECK (
    CASE WHEN "parentId" IS NULL
      THEN "rootId" IS NULL AND "depth" = 0 AND "replyToCommentId" IS NULL AND "replyToUserId" IS NULL
      ELSE "rootId" IS NOT NULL AND "rootId" = "parentId" AND "depth" = 1
    END
  );

-- Порція коренів треду, нові першими (`createdAt DESC, id DESC`): лише корені — відповіді читаються за `rootId`
CREATE INDEX IF NOT EXISTS "Comment_thread_roots_newest_idx"
  ON "Comment" ("threadId", "createdAt" DESC, "id" DESC) WHERE "parentId" IS NULL;
