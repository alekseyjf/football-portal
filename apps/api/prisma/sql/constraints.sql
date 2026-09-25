-- ═════════════════════════════════════════
-- Ручні обмеження, які Prisma не виражає в schema.prisma
-- (football-plan-intermediate.md, розділ 5.1)
--
-- ⚠️ Prisma про них не знає. При КОЖНОМУ squash (розділ 11) цей файл треба
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

-- Рівно одна мова за замовчуванням
CREATE UNIQUE INDEX "Language_single_default_idx"
  ON "Language" ("isDefault") WHERE "isDefault" = true;

-- Один поточний сезон на турнір
CREATE UNIQUE INDEX "Season_single_current_idx"
  ON "Season" ("competitionId") WHERE "isCurrent" = true;

-- Лок: не більше одного RUNNING синку на (provider, scope, target)
CREATE UNIQUE INDEX "SyncRun_single_running_idx"
  ON "SyncRun" ("provider", "scope", "targetRef") WHERE "status" = 'RUNNING';
