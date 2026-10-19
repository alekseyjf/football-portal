-- M1.4.1 (D24): URL новини — `/{locale}/news/{slug}-{number}`, пост шукаємо за номером.
-- Slug лишається один на пост (з EN-заголовка), але більше не унікальний — суфікси колізій (P3-6) не потрібні.

-- DropIndex
DROP INDEX "Post_slug_key";

-- AlterTable: номер видає послідовність Postgres (SERIAL = `@default(autoincrement())`), наявні пости — теж
ALTER TABLE "Post" ADD COLUMN "number" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Post_number_key" ON "Post"("number");

-- Пости з експорту Фази 0 мають slug із суфіксом-таймстемпом (`new-post-1775515992287`, 13 цифр
-- мілісекунд) — прибираємо його
UPDATE "Post"
SET "slug" = regexp_replace("slug", '-[0-9]{13}$', '')
WHERE "slug" ~ '^.+-[0-9]{13}$';
