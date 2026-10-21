-- M1.4.6 (D45): правила тегів — і в БД, бо теги пише не лише API (сід з експорту, ручний SQL).
-- Дубль prisma/sql/constraints.sql: при squash (розділ 11) ця міграція зникає, а обмеження потрапляють у baseline.

-- Tag: slug — адреса сторінки тегу `/{locale}/news/tag/{slug}`, після створення не змінюється (D45). Латиниця
-- в нижньому регістрі й цифри, слова через один дефіс, до 50 символів — як SLUG_PATTERN і TAG_SLUG_MAX_LENGTH в API
ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_slug_format_check"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 50);

-- TagTranslation: назва — не з самих пробілів і до 50 символів (TAG_NAME_MAX_LENGTH). Мінімум (2) і trim тримає API:
-- char_length рахує символи, а JS — UTF-16 (емодзі — 2), тож мінімум у БД міг би відхилити те, що API прийняло
ALTER TABLE "TagTranslation"
  ADD CONSTRAINT "TagTranslation_name_check"
  CHECK (btrim("name") <> '' AND char_length("name") <= 50);
