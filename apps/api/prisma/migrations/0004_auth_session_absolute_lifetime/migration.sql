-- Фаза 2f: абсолютний ліміт життя сесії (30 днів від логіну) + sid (familyId) в access-JWT.

-- AlterTable: колонка спершу nullable — існуючі сесії заповнюємо стартом їхньої сім'ї
ALTER TABLE "AuthSession" ADD COLUMN "familyStartedAt" TIMESTAMP(3);

UPDATE "AuthSession" AS session
SET "familyStartedAt" = family."startedAt"
FROM (
  SELECT "familyId", MIN("createdAt") AS "startedAt"
  FROM "AuthSession"
  GROUP BY "familyId"
) AS family
WHERE session."familyId" = family."familyId";

ALTER TABLE "AuthSession" ALTER COLUMN "familyStartedAt" SET NOT NULL;

-- Живі сесії не мають пережити новий абсолютний ліміт
UPDATE "AuthSession"
SET "expiresAt" = "familyStartedAt" + INTERVAL '30 days'
WHERE "expiresAt" > "familyStartedAt" + INTERVAL '30 days';

-- JwtStrategy на кожен запит: жива сесія сім'ї (familyId + revokedAt IS NULL)
DROP INDEX "AuthSession_familyId_idx";
CREATE INDEX "AuthSession_familyId_revokedAt_idx" ON "AuthSession"("familyId", "revokedAt");
