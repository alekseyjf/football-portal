-- M1.4.4 (D44): обкладинка новини — опис для незрячих мовою перекладу, підпис автора фото — один на пост.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "coverImageCredit" TEXT;

-- AlterTable
ALTER TABLE "PostTranslation" ADD COLUMN     "coverImageAlt" TEXT;

-- Опублікована новина з обкладинкою тепер потребує опису кожною мовою (D44) — наявним даємо заголовок
-- перекладу. Підпис автора фото так не відновиш: його вписує редакція
UPDATE "PostTranslation" AS "translation"
SET "coverImageAlt" = "translation"."title"
FROM "Post" AS "post"
WHERE "post"."id" = "translation"."postId"
  AND "post"."coverImageUrl" IS NOT NULL;
