/** Тег — редакційна тема новин; назва — запитаною мовою (немає — default-мовою, далі slug). */
export class TagDto {
  id!: string;
  /** Адреса сторінки тегу на сайті — `/{locale}/news/tag/{slug}`; не змінюється */
  slug!: string;
  name!: string;
}

/** Назва тегу однією мовою. */
export class AdminTagTranslationDto {
  languageCode!: string;
  name!: string;
}

/** Тег в адмінці: назви всіма мовами й кількість новин. */
export class AdminTagDto {
  id!: string;
  /** Адреса сторінки тегу — `/{locale}/news/tag/{slug}`; після створення не змінюється */
  slug!: string;
  /** Усі назви (порядок мов — як на сайті): видно, якої бракує */
  translations!: AdminTagTranslationDto[];
  /** Новини з тегом — будь-якого статусу, крім видалених: видалення тегу прибере його з усіх */
  postCount!: number;
}

/** `DELETE /tags/{id}`: тег видалено й прибрано з усіх новин. */
export class DeletedTagDto {
  id!: string;
}
