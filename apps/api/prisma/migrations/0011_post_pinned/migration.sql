-- M1.6.4 (D56): головна новина сайту — закріплена редактором. `pinnedAt` — коли закріпили (`null` — ні),
-- `pinnedById` — хто (бачить лише адмінка). Акаунт не видаляється, а анонімізується (D19): SET NULL — лише на випадок
-- фізичного видалення рядка `User` (ручний SQL), закріплення від цього не зникає. Індексу на `pinnedById` немає:
-- не-null там щонайбільше один рядок, а `User` фізично не видаляють.
-- Відкат (ідемпотентний: `migrate deploy` міграцію в транзакцію не загортає — v5-foundation.md, розділ 11) —
-- індекс → FK → колонки, кожне з `IF EXISTS`.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "pinnedAt" TIMESTAMPTZ(3),
ADD COLUMN     "pinnedById" TEXT;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Не більше однієї закріпленої: ключ індексу — стала, тож другий закріплений рядок порушує унікальність.
-- Дубль prisma/sql/constraints.sql (як 0009): Prisma часткових індексів не знає, при squash (розділ 11) обмеження
-- потрапляє в baseline звідти; `IF NOT EXISTS` — щоб обидва файли можна було застосувати один за одним
CREATE UNIQUE INDEX IF NOT EXISTS "Post_single_pinned_idx"
  ON "Post" ((true)) WHERE "pinnedAt" IS NOT NULL;
