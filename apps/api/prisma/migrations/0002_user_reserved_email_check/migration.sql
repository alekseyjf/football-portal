-- Фаза 2d. Дубль prisma/sql/constraints.sql: при squash (розділ 11) ця міграція зникає,
-- а обмеження потрапляє в baseline разом з рештою constraints.sql.

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
