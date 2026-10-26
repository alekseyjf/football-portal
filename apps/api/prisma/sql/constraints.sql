-- ═════════════════════════════════════════
-- Ручні обмеження, які Prisma не виражає в schema.prisma
-- (docs/archive/football-plan-intermediate.md, розділ 5.1)
--
-- ⚠️ Prisma про них не знає. При КОЖНОМУ squash (docs/decisions/v5-foundation.md, розділ 11 і «Prisma та міграції») цей файл треба
-- дописати в кінець нової baseline-міграції (prisma/migrations/0001_init/migration.sql).
-- ⚠️ Кожну нову міграцію генерувати з `--create-only` і перевіряти, що в SQL
-- немає DROP INDEX / DROP CONSTRAINT для об'єктів нижче.
-- ═════════════════════════════════════════

-- CommentThread: рівно одна ціль
ALTER TABLE "CommentThread"
  ADD CONSTRAINT "CommentThread_single_target_check"
  CHECK (num_nonnulls("postId", "matchId") = 1);

-- Match: різні клуби
ALTER TABLE "Match"
  ADD CONSTRAINT "Match_distinct_clubs_check"
  CHECK ("homeClubId" <> "awayClubId");

-- Post: опублікований / запланований має дату публікації
ALTER TABLE "Post"
  ADD CONSTRAINT "Post_published_has_date_check"
  CHECK ("status" NOT IN ('PUBLISHED', 'SCHEDULED') OR "publishedAt" IS NOT NULL);

-- Tag: slug — адреса сторінки тегу, не змінюється (D45): латиниця в нижньому регістрі й цифри,
-- слова через один дефіс, до 50 символів — як SLUG_PATTERN і TAG_SLUG_MAX_LENGTH в API
ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_slug_format_check"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 50);

-- TagTranslation: назва — не з самих пробілів і до 50 символів (TAG_NAME_MAX_LENGTH); мінімум (2) і trim — в API
ALTER TABLE "TagTranslation"
  ADD CONSTRAINT "TagTranslation_name_check"
  CHECK (btrim("name") <> '' AND char_length("name") <= 50);

-- Рівно одна мова за замовчуванням
CREATE UNIQUE INDEX "Language_single_default_idx"
  ON "Language" ("isDefault") WHERE "isDefault" = true;

-- Один поточний сезон на турнір
CREATE UNIQUE INDEX "Season_single_current_idx"
  ON "Season" ("competitionId") WHERE "isCurrent" = true;

-- Post: не більше однієї закріпленої головної новини (D56) — ключ індексу стала. Те саме — у міграції 0011,
-- тож `IF NOT EXISTS`
CREATE UNIQUE INDEX IF NOT EXISTS "Post_single_pinned_idx"
  ON "Post" ((true)) WHERE "pinnedAt" IS NOT NULL;

-- Лок: не більше одного RUNNING синку на (provider, scope, target)
CREATE UNIQUE INDEX "SyncRun_single_running_idx"
  ON "SyncRun" ("provider", "scope", "targetRef") WHERE "status" = 'RUNNING';

-- User: адреси на TLD .invalid — лише в анонімізованих акаунтів (D19, P2-17), і лише
-- у форматі deleted-<id>@removed.invalid. Інакше можна заздалегідь зайняти адресу
-- анонімізації чужого акаунта й зламати йому видалення на @unique. Заодно гарантує:
-- DELETED => email анонімізовано. Формат — apps/api/src/users/deleted-account.ts
ALTER TABLE "User"
  ADD CONSTRAINT "User_reserved_email_check"
  CHECK (
    CASE WHEN "status" = 'DELETED'
      THEN "email" = 'deleted-' || "id" || '@removed.invalid'
      ELSE lower("email") NOT LIKE '%.invalid'
    END
  );
