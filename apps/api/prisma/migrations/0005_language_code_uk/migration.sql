-- M1.2 (D22): код української мови `ua` (код країни) → `uk` (ISO 639-1).
-- FK `PostTranslation` / `TagTranslation` → `Language.code` мають ON UPDATE CASCADE:
-- переклади переїжджають разом з первинним ключем, в одній інструкції.
-- Порожня БД (міграції до seed) — 0 рядків, нічого не робить.
UPDATE "Language" SET "code" = 'uk' WHERE "code" = 'ua';
